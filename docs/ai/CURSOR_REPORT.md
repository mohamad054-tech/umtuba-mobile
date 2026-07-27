# Cursor Report — World Roads & Buildings Experience V1

## Summary

Added Roads & Buildings experience for World maps via Runtime preferences + MapSource-owned vector overlays + MapLibre renderer layers. UI never imports MapLibre. Preferences (`roadDetail`, `buildings`) apply without Runtime reinitialization and preserve camera, selection, layers, and map source. Fail-closed: unsupported 3D falls back to 2D/off; missing overlays stay Mercator basemap-only.

## Exact files changed

### New
- `components/world/WorldMapExperienceSelector.tsx`
- `src/lib/world/mapSource/experience.ts`
- `src/lib/world/renderer/maplibre/roadsBuildings.ts`
- `src/lib/world/renderer/maplibre/MapLibreRoadsBuildingsLayer.tsx`
- `src/lib/world/renderer/roadsBuildings.test.ts`

### Modified
- `app/world.tsx`
- `components/world/WorldExperienceShell.tsx`
- `src/lib/world/experience.ts`
- `src/lib/world/index.ts`
- `src/lib/world/mapSource/{types,index,street,satellite,terrain}MapSource.ts`
- `src/lib/world/renderer/{index,types via caps,null N/A,renderer.test}.ts`
- `src/lib/world/renderer/maplibre/{MapLibreRendererAdapter,MapLibreMapSurface}.ts(x)`
- `src/lib/world/runtime/controller.ts`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None.

## Security review

- No secrets / `.env` changes.
- Tile URLs remain owned by MapSource (`experience.ts`); renderer receives overlay specs from Runtime only.
- UI has no MapLibre / tile URL access.

## Tests

**347/347 PASS** (42 files)

## TypeScript

**PASS** (`npx tsc --noEmit`)

## Build

Not run (EAS Build deferred per task note).

## git diff --check

**PASS**

## git status --short

(see after commit)

## Open issues

- Streets basemap (OpenFreeMap liberty) already paints roads/2D buildings; road-detail overlays apply primarily on Satellite/Terrain; 3D buildings use vector overlay when supported.
- Terrain source intentionally disables buildings 3D (`supportsBuildings3d: false`).
- 3D is never auto-enabled (default buildings preference is `2d`).
