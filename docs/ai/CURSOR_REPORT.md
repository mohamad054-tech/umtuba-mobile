# CURSOR_REPORT — World Globe Experience V1

## Summary

Implemented World Globe Experience V1 with architecture-correct fail-closed projection handling. MapLibre Native does not support native globe projection yet (no `Map.projection`; MapLibre Native issue #3161), so V1 ships the full ProjectionAdapter + Runtime policy layer while staying on Mercator at runtime.

- Extended `ProjectionAdapter` with `getProjection()` / `setProjection()` and `RendererCapabilities` with `supportsGlobe` / `supportsProjectionSwitch`.
- MapLibre adapter: `supportsGlobe: false`, `supportsProjectionSwitch: true`; globe attempts return false without crash, camera/markers/layers/style preserved.
- Runtime owns `projectionPreference` (`auto` | `globe` | `map`), applies zoom-based auto policy via `resolveAutoProjection` with hysteresis (4.2 / 5.0), subscribes to renderer camera sync for auto mode.
- UI: `WorldProjectionSelector` Globe/Map chips wired through Runtime view state — no MapLibre imports in UI.

## Exact files changed

- `app/world.tsx`
- `components/world/WorldExperienceShell.tsx`
- `components/world/WorldProjectionSelector.tsx` (new)
- `docs/ai/CURSOR_REPORT.md`
- `src/lib/world/experience.ts`
- `src/lib/world/index.ts`
- `src/lib/world/renderer/globe.test.ts` (new)
- `src/lib/world/renderer/index.ts`
- `src/lib/world/renderer/maplibre/MapLibreRendererAdapter.ts`
- `src/lib/world/renderer/maplibre/projection.ts` (new)
- `src/lib/world/renderer/nullRenderer.ts`
- `src/lib/world/renderer/renderer.test.ts`
- `src/lib/world/renderer/types.ts`
- `src/lib/world/runtime/controller.ts`

## Migrations created

None.

## Security review

- UI never imports MapLibre; projection flows Runtime → ProjectionAdapter only.
- Fail-closed: unsupported globe returns false, stays Mercator, no crash, no camera/selection/layer/map-source reset.
- No WebView or alternate map engine added.
- No secrets or tile URLs exposed through projection controls.

## Tests

PASS (`npm test`) — **332/332** tests passed.

New coverage in `globe.test.ts`:
- `resolveAutoProjection` hysteresis unit tests
- Null renderer caps: both globe flags false
- MapLibre caps: `supportsProjectionSwitch: true`, `supportsGlobe: false`
- MapLibre `setProjection("globe")` fail-closed; mercator succeeds; camera unchanged
- `buildWorldProjectionControls` enabled/disabled logic
- Runtime manual `setProjectionPreference` globe/map
- Runtime auto zoom switching with globe-capable mock renderer (no reinit)
- Fallback when globe unsupported keeps Mercator; Map chip active
- Selection, registries, map source, data bundle preserved across preference switch
- MapLibre runtime stays Mercator on globe preference

Updated in `renderer.test.ts`:
- New capability fields on null and MapLibre adapters
- Projection adapter get/set tests on MapLibre

## TypeScript

PASS (`npx tsc --noEmit`).

## Build

Not run (not required for this feature scope).

## git diff --check

PASS.

## git status --short

Modified/added files listed above. Pre-existing untracked local files (`build.json*`, other `docs/ai/*.md` except this report) untouched.

## Open issues

Native globe projection unavailable on MapLibre React Native v11 until MapLibre Native adds globe support (issue #3161). When available, enable `supportsGlobe: true` in MapLibre adapter and wire native projection API in `setProjection` — Runtime/UI/policy layer is ready.
