/*
 * Copyright 2014-2015 Fabian Tollenaar <fabian@starting-point.nl>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PropertyValues, PropertyValuesCallback } from '@signalk/server-api'
import fs from 'fs'
import _ from 'lodash'
import { Duplex, Writable } from 'stream'
import { SignalKMessageHub, WithConfig } from './app'
import { createDebug } from './debug'
import { EventsActorId, WithWrappedEmitter } from './events'

interface PipeElementConfig {
  type: string
  options?: {
    providerId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emitPropertyValue: (name: string, value: any) => void
    onPropertyValues: (name: string, cb: PropertyValuesCallback) => void
    app: unknown
  }
  enabled?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optionMappings: any
}
interface PipedProviderConfig {
  enabled: boolean
  enableFile?: string
  id: string
  pipeElements: PipeElementConfig[]
}

class PipedProvider {}

const ENABLE_FILE_POLL_INTERVAL_MS = 1000

export function pipedProviders(
  app: SignalKMessageHub &
    WithConfig &
    WithWrappedEmitter & {
      propertyValues: PropertyValues
      setProviderError: (providerId: string, msg: string) => void
      setProviderStatus: (providerId: string, msg: string) => void
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      providers: any[]
    }
) {
  function createPipedProvider(providerConfig: PipedProviderConfig) {
    const { propertyValues, ...sanitizedApp } = app
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emitPropertyValue = (name: string, value: any) =>
      propertyValues.emitPropertyValue({
        timestamp: Date.now(),
        setter: `provider:${providerConfig.id}`,
        name,
        value
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onPropertyValues = (name: string, cb: (value: any) => void) =>
      propertyValues.onPropertyValues(name, cb)
    const boundEventMethods = app.wrappedEmitter.bindMethodsById(
      `connection:${providerConfig.id}` as EventsActorId
    )
    const appFacade = {
      emitPropertyValue,
      onPropertyValues,
      ...sanitizedApp,
      ...boundEventMethods,
      toJSON: () => 'appFacade'
    }

    const result = {
      id: providerConfig.id,
      pipeElements: providerConfig.pipeElements.reduce<Duplex[]>(
        (res, config) => {
          if (typeof config.enabled === 'undefined' || config.enabled) {
            res.push(
              createPipeElement({
                ...config,
                options: {
                  providerId: providerConfig.id,
                  app: appFacade,
                  ...config.options,
                  emitPropertyValue,
                  onPropertyValues
                }
              })
            )
          }
          return res
        },
        []
      )
    }

    for (let i = result.pipeElements.length - 2; i >= 0; i--) {
      result.pipeElements[i].pipe(result.pipeElements[i + 1])
    }

    const deltaSink = new Writable({
      objectMode: true,
      write(msg, _encoding, done) {
        app.handleMessage(providerConfig.id, msg)
        done()
      }
    })
    result.pipeElements[result.pipeElements.length - 1].pipe(deltaSink)
    app.emit('pipedProvidersStarted', providerConfig)
    return result
  }

  function createPipeElement(elementConfig: PipeElementConfig): Duplex {
    if (elementConfig.optionMappings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elementConfig.optionMappings.forEach(function (mapping: any) {
        if (_.get(app, mapping.fromAppProperty)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(elementConfig.options as any)[mapping.toOption] = _.get(
            app,
            mapping.fromAppProperty
          )
        }
      })
    }
    const efectiveElementType = elementConfig.type.startsWith('providers/')
      ? elementConfig.type.replace('providers/', '@signalk/streams/')
      : elementConfig.type
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(efectiveElementType)
    const Ctor = mod.default ?? mod
    return new Ctor({
      ...elementConfig.options,
      createDebug
    })
  }

  // enableFile holds `on`, or `off` and the reason on the next line. When off,
  // this also shows the reason as the connection's status.
  function mayStart(config: PipedProviderConfig) {
    const enabled = typeof config.enabled === 'undefined' || config.enabled
    if (!enabled) {
      return false
    }
    if (!config.enableFile) {
      return true
    }
    let content = ''
    try {
      content = fs.readFileSync(config.enableFile, 'utf8')
    } catch {
      // missing: off
    }
    const [state, reason] = content.split('\n')
    const on = state.trim() === 'on'
    app.setProviderStatus(config.id, on ? '' : reason?.trim() || 'Off')
    return on
  }

  function startProviders() {
    if (app.config.settings.pipedProviders) {
      const piped = (
        app.config.settings.pipedProviders as PipedProviderConfig[]
      ).reduce<PipedProvider[]>((result, config) => {
        if (config.enableFile) {
          // fs.watchFile, not fs.watch: a stat poll also sees the file
          // appear with its directory. A rewrite with the same content
          // still restarts: after the interface went down and up, the old
          // socket stays silent.
          fs.watchFile(
            config.enableFile,
            { interval: ENABLE_FILE_POLL_INTERVAL_MS },
            () => restartProvider(config.id)
          )
        }
        try {
          if (mayStart(config)) {
            result.push(createPipedProvider(config))
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          app.setProviderError(config.id, e.message)
          console.error(e)
        }
        return result
      }, [])

      return piped.filter(function (n) {
        return n !== null && n !== undefined
      })
    } else {
      console.error('No pipedProviders in the settings file')
      return []
    }
  }

  function stopProvider(id: string) {
    const idx = app.providers.findIndex((p: { id: string }) => p.id === id)
    if (idx !== -1) {
      app.providers[idx].pipeElements[0].end()
      app.providers.splice(idx, 1)
    }
    app.wrappedEmitter.removeAllListenersById(
      `connection:${id}` as EventsActorId
    )
  }

  function restartProvider(id: string) {
    stopProvider(id)
    const providerConfig = (
      app.config.settings.pipedProviders as PipedProviderConfig[]
    )?.find((p) => p.id === id)
    if (providerConfig && mayStart(providerConfig)) {
      try {
        app.providers.push(createPipedProvider(providerConfig))
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        app.setProviderError(id, message)
        console.error(e)
      }
    }
  }

  return {
    start: startProviders,
    createPipedProvider,
    stopProvider,
    restartProvider
  }
}
