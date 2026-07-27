# CURSOR_REPORT — World Satellite Source V1

## Summary

Activated Street and Satellite map sources with styles owned by MapSource (ESRI World Imagery inline data URI for satellite; OpenFreeMap Liberty for streets). Added `MapLibreRendererAdapter.setStyleUrl()` for runtime style swap without resetting session camera. Added `WorldRuntimeController.setMapSourceId()` / `setMapSourceKind()` to switch sources without full reinit — preserves camera, selection, and layer markers with fail-closed Demo fallback. Exposed `mapSources` in view state and wired `WorldMapSourceSelector` in the World shell.

## Exact files changed

- `app/world.tsx`
- `components/world/WorldExperienceShell.tsx`
- `components/world/WorldMapSourceSelector.tsx` (new)
- `docs/ai/CURSOR_REPORT.md`
- `src/lib/world/experience.ts`
- `src/lib/world/index.ts`
- `src/lib/world/mapSource/index.ts`
- `src/lib/world/mapSource/mapSource.test.ts`
- `src/lib/world/mapSource/satelliteMapSource.ts`
- `src/lib/world/mapSource/streetMapSource.ts`
- `src/lib/world/renderer/maplibre/MapLibreRendererAdapter.ts`
- `src/lib/world/runtime/controller.ts`

## Migrations created

None.

## Security review

- Renderer does not hardcode tile URLs; all styles injected from MapSource via Runtime.
- UI never receives or sets style URLs — only source ids through `onSelectMapSource`.
- Fail-closed: unavailable/broken preferred source falls back to Demo; empty `setStyleUrl` rejected.
- Demo remains development fallback; Terrain stays unavailable placeholder.

## Tests

PASS (`npm test`) — **312/312** tests passed.

New/updated coverage in `mapSource.test.ts`:
- Street + Satellite available; Terrain unavailable
- Registry lists 3 available sources (Demo, Street, Satellite)
- Runtime `setMapSourceId` street → satellite preserves camera
- Selection + places layer/markers preserved across switch
- Fail-closed fallback to Demo for broken satellite
- Attribution updates in view state
- `setStyleUrl` bumps mountGeneration, preserves sessionCamera

## TypeScript

PASS (`npx tsc --noEmit`).

## Build

Not run (not required for this feature scope).

## git diff --check

PASS.

## git status --short

Modified files listed above; new `components/world/WorldMapSourceSelector.tsx`. Pre-existing untracked local files (`build.json*`, other `docs/ai/*.md` except this report) untouched.

## Open issues

None identified in feature scope.
