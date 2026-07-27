# CURSOR_REPORT — World Terrain Source V1

## Summary

Activated Terrain map source with Esri World Topographic Map inline data-URI style owned by MapSource (mirroring Satellite V1). MapLibre adapter now advertises `supportsTerrain: true` and `supportsSatellite: true`, with fail-closed `setTerrainEnabled()` / `isTerrainEnabled()` for terrain-capable styles. Runtime includes terrain in the Streets / Satellite / Terrain switcher, extends `setMapSourceKind("terrain")`, gates terrain when renderer lacks terrain support (Demo fallback, camera preserved), and soft-enables terrain after successful switch. Registry now lists 4 available sources (Demo, Street, Satellite, Terrain).

## Exact files changed

- `components/world/WorldMapSourceSelector.tsx`
- `docs/ai/CURSOR_REPORT.md`
- `src/lib/world/experience.ts`
- `src/lib/world/mapSource/index.ts`
- `src/lib/world/mapSource/mapSource.test.ts`
- `src/lib/world/mapSource/registry.ts`
- `src/lib/world/mapSource/terrainMapSource.ts`
- `src/lib/world/renderer/maplibre/MapLibreRendererAdapter.ts`
- `src/lib/world/renderer/renderer.test.ts`
- `src/lib/world/runtime/controller.ts`

## Migrations created

None.

## Security review

- Renderer does not hardcode tile URLs; terrain style injected from MapSource via Runtime.
- UI never receives or sets style URLs — only source ids through `onSelectMapSource`.
- Fail-closed: unavailable/broken terrain or renderer without `supportsTerrain` falls back to Demo without crash; camera/selection/layers preserved.
- Esri World Topo attribution string exposed via MapSource only.
- No API keys or custom DEM hosting in V1.

## Tests

PASS (`npm test`) — **317/317** tests passed.

New/updated coverage in `mapSource.test.ts`:
- Terrain available with inline ESRI World Topo data URI
- Registry lists 4 available sources (Demo, Street, Satellite, Terrain)
- Resolve terrain id works
- Runtime `setMapSourceId` street → satellite → terrain preserves camera
- Selection + places layer/markers preserved across terrain switch
- Fail-closed fallback to Demo for broken terrain
- Capability gating: renderer without terrain support → Demo fallback
- Attribution updates for terrain (Esri)
- `setMapSourceKind("terrain")` works
- Preferred unavailable id uses fake missing id (not terrain)

New/updated coverage in `renderer.test.ts`:
- MapLibre caps: `supportsTerrain: true`, `supportsSatellite: true`
- `setTerrainEnabled` fail-closed off non-terrain styles
- Terrain enable succeeds on terrain-capable style when mounted; clears on style swap

## TypeScript

PASS (`npx tsc --noEmit`).

## Build

Not run (not required for this feature scope).

## git diff --check

PASS.

## git status --short

Modified files listed above. Pre-existing untracked local files (`build.json*`, other `docs/ai/*.md` except this report) untouched.

## Open issues

None identified in feature scope. V1 uses topographic raster basemap only — no MapLibre DEM/hillshade elevation layer until custom terrain hosting is available.
