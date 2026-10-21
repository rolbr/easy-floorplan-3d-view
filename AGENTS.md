# AGENTS.md

Easy Floorplan 3D: a Home Assistant custom card that fetches floor data from the Easy Floorplan card and renders it in 3D with three.js. TypeScript, Vite, Biome, Vitest, pnpm.

## Commands

- Use `pnpm`
- Before finishing a change:
  - update affected comments and `AGENTS.md` when behavior, architecture, or conventions change
  - all three must pass: `pnpm typecheck`, `pnpm check` (fix: `pnpm check-fix`), `pnpm test`

## Dependencies

- Pin versions exactly, as `package.json` does
- `dist/`, `stats.html` are not source; do not edit or lint them

## Documentation

- In JSDoc `/** */` comments, use a backslash ` \` at the end of a line to make VS Code render a line break in the hover documentation
- Don't end list items with `.`

## Code layout

```
src/
  card.ts, main.ts   Card entry points
  load-floor.ts      Loads one floor from the source card config
  types.ts           Shared types
  config/            Constants and static maps
  lib/               Domain and Home Assistant logic, no knowledge of the card's DOM
  utils/             Generic helpers
  builder/           three.js scene construction
  editor/            Card editor
  ui/                Template, element refs (`TemplateRefs`), controls and controllers bound to them, styles
```

### Buckets

| Bucket             | Typical content                                        | May import                              |
| ------------------ | ------------------------------------------------------ | --------------------------------------- |
| utils/             | Project-agnostic helpers (clamp, ease, deep-equal ...) | Nothing from the project                |
| config/ , types.ts | Defaults, tunables, domain types                       | types.ts may import config/ type-only   |
| lib/               | Project logic, integration, no DOM knowledge           | utils/ , config/ , types                |
|                    |                                                        |                                         |
| builder/ , editor/ | Large feature modules                                  | Everything below them                   |
| ui/                | Template, element refs, controls / controllers         | Everything below it, own types.         |
|                    |                                                        |                                         |
| card.ts , main.ts  | Entry points that wire the above together              | Everything                              |


#### Another approach - consider if `lib/` grows past 20 files
Group by feature instead layer, with folders like `clip/`, `time/` and `markers/` that each hold their logic, controller and tests. Reads well, but moves nearly every file and splits shared things like `world.ts` and `camera.ts`.

### Rules
- Imports flow one way: `utils/` -> `lib/` -> `card.ts`, `editor/`, `ui/`
- If code needs this project's types or concepts, it goes in `lib/`
- `utils/` imports nothing from the project
- `lib/` never imports from `editor/`, `ui/`, `builder/` or `card.ts`
- Code that needs the card's DOM refs (`TemplateRefs`) belongs in `ui/`, not `lib/`
- Types used by a single module stay in that module; `types.ts` is for types shared across modules
- Do not import runtime code from a feature module (e.g. `load-floor.ts`) into another feature just to reuse a helper. Move the helper to `lib/`

## Lovelace access

All reads of dashboard configs go through `src/lib/lovelace.ts` (`fetchDashboardConfig`, `findView`, `findCardsInView`). Do not call `lovelace/config` directly elsewhere.

- A view without `path` is addressed by its index, as in HA URLs
- `findCardsInView` defines the traversal order that `card_index` relies on, in both loader and editor. Do not change that order without updating both
- `fetchDashboardConfig` throws on failure; the caller decides how to handle it

## Conventions

- Biome is the formatter and linter: single quotes, 2-space indent, 140 columns. Do not add a second formatter
- No non-null assertions (`!`). Narrow the type or use named variables in tests
- Keep data-access modules pure: no DOM, no three.js
- Log with the `[efp3d]` prefix

## Testing

- Vitest, tests next to the code as `*.test.ts`
- Test pure logic (helpers, resolvers, loaders) with plain fixtures. Stub `hass.connection.sendMessagePromise` instead of mocking modules
- Add a test with every bug fix or new helper in `lib/` or `utils/`
