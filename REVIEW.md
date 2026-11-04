# Review rules

What a change to Signal K server needs before a maintainer reviews it. These are the points Teppo Kurki, the lead maintainer, raised most often in his reviews between November 2025 and November 2026. Each rule has an example from a real review, with the PR it comes from.

Contributors and their coding agents check their change against this list before asking for review. Automated reviewers (CodeRabbit, Copilot, Claude) check PRs against it and name the rule a finding breaks. AGENTS.md, CONTRIBUTING.md and the PR template still apply; this file adds to them.

## Scope

- One logical change per PR. Unrelated improvements, formatting or refactors go in separate commits at least, better in separate PRs.
  > "Every PR having unrelated code improvements is kryptonite to my throughput. Minimum is separate commits." ([#2287](https://github.com/SignalK/signalk-server/pull/2287))
- A behaviour change doesn't hide inside a conversion or refactor.
  > "Ws ping should be a separate pr - behavior change/feature, not part of conversion to typescript." ([#2284](https://github.com/SignalK/signalk-server/pull/2284))
- A large feature comes in parts a reviewer can take one at a time.
  > "This PR is getting to the "too many things to digest at once" category." ([#2379](https://github.com/SignalK/signalk-server/pull/2379))

## Motivation and description

- The description says what problem the change solves, and why a user would want it.
  > "You skipped the motivation: why would a user need/want to clear the log?" ([#3131](https://github.com/SignalK/signalk-server/pull/3131))
  > "What is the problem that this is fixing?" ([#3195](https://github.com/SignalK/signalk-server/pull/3195))
- Every claim in the title, description, docs and comments is true for the code as it is now: no leftovers from earlier iterations, no invented APIs.
  > "in PR description leftover? Don't see it in the code" ([#2365](https://github.com/SignalK/signalk-server/pull/2365))
  > "This won't converge if your changes include hallucinations." ([#2158](https://github.com/SignalK/signalk-server/pull/2158))

## Reuse what exists; one way to do a thing

- Use existing helpers, types, guards and mechanisms instead of adding new ones. Search `src/` and `packages/server-api` first.
  > "There are existing types for these in @signalk/server-api." ([#2205](https://github.com/SignalK/signalk-server/pull/2205))
  > "Why would we reimplement token extraction here differently, when authorizeWS already has all the related code?" ([#2588](https://github.com/SignalK/signalk-server/pull/2588))
  > "There's already disableWriteSettings that is used as a guard in writeSettingsFile." ([#2984](https://github.com/SignalK/signalk-server/pull/2984))
- No second way of doing something that already has one.
  > "I don't want two ways to go about this." ([#3204](https://github.com/SignalK/signalk-server/pull/3204))
- Prefer a widely used library or a Node built-in over hand-written logic, but don't add a dependency for something small, and no native modules in the server.
  > "I think it would be a good idea to use libraries that are in wide use instead of error-prone hand/ai crafted logic" ([#2204](https://github.com/SignalK/signalk-server/pull/2204))
  > "making it a hard dependency of the server codebase for something so small seems not worth it." ([#2265](https://github.com/SignalK/signalk-server/pull/2265))
  > "Let's not add (sqlite3) native libraries as dependencies in the server proper." ([#2158](https://github.com/SignalK/signalk-server/pull/2158))
- Follow the conventions of the existing APIs: naming, registration by plugin id, parameters.
  > "See how other apis do it." ([#2381](https://github.com/SignalK/signalk-server/pull/2381))

## Structure

- Feature logic goes in its own module, not in `index.ts` or other central files; routes go in `serverroutes.ts`.
  > "To me this and emitFilteredWebappsList belong in plugins.ts, not index.ts." ([#2158](https://github.com/SignalK/signalk-server/pull/2158))
  > "I would expect to find these routes in serverroutes.ts" ([#2365](https://github.com/SignalK/signalk-server/pull/2365))
- Functions do what their name says, without hidden side effects.
  > "No side effects, clearer responsibilities." ([#2499](https://github.com/SignalK/signalk-server/pull/2499))
- The server owns state and emits server events; the admin UI doesn't poll to rebuild it.
  > "The server should be managing the history providers state and emitting serverevents that communicate the state to the ui" ([#2839](https://github.com/SignalK/signalk-server/pull/2839))
- Types, not `any` with ignore comments.
  > "Prefer typing things over adding ignore comments for `any` complaints." ([#2158](https://github.com/SignalK/signalk-server/pull/2158))

## Compatibility

- Say what the change does to plugins, webapps, existing configurations and installs, including GX devices and Docker. Don't break existing configurations; for existing setups, new behaviour is opt-in or keeps the old default.
  > "Breaks existing configurations, don’t think we want to do that." ([#2499](https://github.com/SignalK/signalk-server/pull/2499))
  > "I don't think we can add the ip restriction by default" ([#2204](https://github.com/SignalK/signalk-server/pull/2204))
- No new setting for something people never need to change.
  > "it would be a pretty obscure setting that "normal people" never need to touch." ([#2246](https://github.com/SignalK/signalk-server/pull/2246))
- Don't alarm users: no new error states, banners or startup errors for things that aren't errors.
  > "new extra error messages during startup are startling for end users" ([#2601](https://github.com/SignalK/signalk-server/pull/2601))

## Tests

- Tests cover the scenario the change is about, not only the happy path. Move logic into a unit that can be tested.
  > "I think this is important enough to have tests for the serverside functionality." ([#2225](https://github.com/SignalK/signalk-server/pull/2225))
  > "extract the accumulation to LatestValuesAccumulator.ts or something like that and have tests to assert its behavior" ([#2235](https://github.com/SignalK/signalk-server/pull/2235))
- Test names say what the test checks.
  > "There's no grouping by timestamp, the test name is off." ([#2235](https://github.com/SignalK/signalk-server/pull/2235))

## Testing in the real world

- For changes to connections, data paths, startup or performance, say how it was tested on real devices or with real data.
  > "How well have you tested this? Do serialports for example restart ok?" ([#2332](https://github.com/SignalK/signalk-server/pull/2332))
  > "If you play back plaka repeatedly without any throttling with a reproducible client setup deltas/s might provide some comparable numbers" ([#2384](https://github.com/SignalK/signalk-server/pull/2384))

## Naming

- Names say exactly what the thing is and match the spec and the existing APIs. Booleans are positive.
  > "the flag should be positive: `safeToPersistSettings`" ([#2984](https://github.com/SignalK/signalk-server/pull/2984))
  > "for consistency this should be `full-model`" ([#2158](https://github.com/SignalK/signalk-server/pull/2158))

## Comments, docs and logging

- No speculative comments, and no comments that explain the PR or an old bug: that belongs in the commit message.
  > "I suspect nobody will remember to remove the speculative comment, so better to leave it out." ([#2158](https://github.com/SignalK/signalk-server/pull/2158))
  > "i think the point belongs in commit/pr description, not permanently in the codebase." ([#2676](https://github.com/SignalK/signalk-server/pull/2676))
- Docs are short and written for people.
  > "It is very easy to add AI generated content, but I fear nobody will keep it up to date nor remove stale content, so let's try to be a bit leaner." ([#2158](https://github.com/SignalK/signalk-server/pull/2158))
- New behaviour is documented where users look for it: environment variables in `command_line.md`, settings in the admin UI.
  > "Please add these to command_line.md" ([#2235](https://github.com/SignalK/signalk-server/pull/2235))
  > "Is the setting not available via the UI? If not it should definitely be there" ([#2204](https://github.com/SignalK/signalk-server/pull/2204))
- No `console.log`: use `debug` for diagnostics and `console.error` for errors.
  > "Use either debug or console.error for errors, don't want to make the server log verbose by default." ([#2158](https://github.com/SignalK/signalk-server/pull/2158))

## Process

- Rebase on master instead of merging master in, and fix conflicts before asking for review.
  > "in general rebasing on master is a much better option" ([#2158](https://github.com/SignalK/signalk-server/pull/2158))
- A clean history, with fixes squashed into the commits they belong to.
  > "I don't want 100+ tweakthisandthat commits in master" ([#2158](https://github.com/SignalK/signalk-server/pull/2158))
- CI green, formatted and linted.
  > "Please `npm run format` and `npm run lint` and fix lint errors." ([#2158](https://github.com/SignalK/signalk-server/pull/2158))
- Settle CodeRabbit's findings first, then comment "Ready for human review", as CONTRIBUTING.md asks.
- Answer review comments yourself, in your own words. Don't pass them to an AI and post what it says.
  > "My question about adding an enum was meant as a question, not as a prompt to Claude to try to fix this particular issue. Talking to an AI via Github is not my favorite activity." ([#2325](https://github.com/SignalK/signalk-server/pull/2325))
- Don't reply "will do" to each comment; push the fixes.
  > "I appreciate the comment that you'll continue the work, but no need to comment on each item until each has been addressed." ([#2158](https://github.com/SignalK/signalk-server/pull/2158))
