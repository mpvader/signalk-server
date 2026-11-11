import { expect } from 'chai'
import { EventEmitter } from 'events'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { pipedProviders } from '../src/pipedproviders'

// Venus OS writes `on`, or `off` and a reason, to a file per CAN port and
// rewrites it whenever it reconfigures the port.
describe('piped providers: enableFile', () => {
  let dir: string
  let element: string
  let enableFile: string
  let fileChanged: (() => void) | undefined
  const watchFile = fs.watchFile

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-enablefile-'))
    element = path.join(dir, 'element.js')
    fs.writeFileSync(
      element,
      `const { PassThrough } = require('stream')
      module.exports = function () { return new PassThrough({ objectMode: true }) }`
    )
  })

  beforeEach(() => {
    enableFile = path.join(dir, 'can0')
    fs.rmSync(enableFile, { force: true })
    fileChanged = undefined
    // The stat poll is libuv's; a test fires the change itself
    ;(fs as { watchFile: unknown }).watchFile = (
      _file: string,
      _options: unknown,
      listener: () => void
    ) => {
      fileChanged = listener
    }
  })

  afterEach(() => {
    fs.watchFile = watchFile
  })

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function start(config: object) {
    const statuses: string[] = []
    const app = Object.assign(new EventEmitter(), {
      config: {
        settings: {
          pipedProviders: [
            { id: 'n2k', pipeElements: [{ type: element }], ...config }
          ]
        }
      },
      propertyValues: {
        emitPropertyValue: () => {},
        onPropertyValues: () => {}
      },
      wrappedEmitter: {
        bindMethodsById: () => ({}),
        removeAllListenersById: () => {}
      },
      handleMessage: () => {},
      setProviderError: () => {},
      setProviderStatus: (_id: string, msg: string) => statuses.push(msg),
      providers: [] as { id: string }[]
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.providers = pipedProviders(app as any).start() as { id: string }[]
    return { app, statuses }
  }

  const ids = (app: { providers: { id: string }[] }) =>
    app.providers.map((p) => p.id)

  const cases: [string, string | undefined, string[], string][] = [
    ['on', 'on\n', ['n2k'], ''],
    ['on, untrimmed, no newline', ' on ', ['n2k'], ''],
    ['off with a reason', 'off\n Port disabled \n', [], 'Port disabled'],
    ['off without a reason', 'off\n', [], 'Off'],
    ['empty', '', [], 'Off'],
    ['missing', undefined, [], 'Off']
  ]
  cases.forEach(([name, content, started, status]) => {
    it(`file ${name}`, () => {
      if (content !== undefined) {
        fs.writeFileSync(enableFile, content)
      }
      const { app, statuses } = start({ enableFile })
      expect(ids(app)).to.deep.equal(started)
      expect(statuses).to.deep.equal([status])
    })
  })

  it('follows changes, and restarts on a rewrite with the same content', () => {
    const { app, statuses } = start({ enableFile })
    expect(ids(app)).to.deep.equal([])

    fs.writeFileSync(enableFile, 'on\n')
    fileChanged!()
    const first = app.providers[0]
    expect(ids(app)).to.deep.equal(['n2k'])

    fileChanged!()
    expect(ids(app)).to.deep.equal(['n2k'])
    expect(app.providers[0]).to.not.equal(first)

    fs.writeFileSync(enableFile, 'off\nPort disabled\n')
    fileChanged!()
    expect(ids(app)).to.deep.equal([])
    expect(statuses).to.deep.equal(['Off', '', '', 'Port disabled'])
  })

  it('uses the id the connection has when the file changes', () => {
    const { app } = start({ enableFile })
    app.config.settings.pipedProviders[0].id = 'renamed'
    fs.writeFileSync(enableFile, 'on\n')
    fileChanged!()
    expect(ids(app)).to.deep.equal(['renamed'])
  })

  it('enabled: false wins over on', () => {
    fs.writeFileSync(enableFile, 'on\n')
    const { app, statuses } = start({ enableFile, enabled: false })
    fileChanged!()
    expect(ids(app)).to.deep.equal([])
    expect(statuses).to.deep.equal([])
  })

  it('without enableFile nothing changes', () => {
    const { app, statuses } = start({})
    expect(ids(app)).to.deep.equal(['n2k'])
    expect(statuses).to.deep.equal([])
    expect(fileChanged).to.equal(undefined)
  })
})
