# CURSOR_REPORT — World Places UX V1

## Summary

Professional Places UX on the existing Places foundation: UMTUBA-styled zoom-scaled markers, labels at appropriate zoom, GeoJSON clustering that separates on zoom-in, Capitals / Major / Minor layer toggles, selection highlight + camera focus, and a bottom sheet with name/country/kind plus null metric placeholders (Population, Users, Education, Events, Games). Architecture preserved: Runtime → Renderer Adapter → Places; UI never imports `@maplibre/*` or place providers. Fail-closed; no fake metrics.

## Exact files changed

### New
- `src/lib/world/places/placeUx.ts` — tiers, zoom thresholds, clustering helpers, marker radius
- `src/lib/world/places/placeSheet.ts` — bottom sheet state with null placeholders
- `src/lib/world/renderer/maplibre/MapLibrePlacesLayer.tsx` — GeoJSONSource + cluster/circle/symbol layers
- `components/world/WorldPlaceBottomSheet.tsx`
- `components/world/WorldPlaceLayerSelector.tsx`

### Modified
- `places/types.ts`, `parsePlace.ts`, `demoPlaceProvider.ts`, `placesLayer.ts`, `index.ts`
- `places/places.test.ts` — UX coverage (tiers, layers, sheet, clustering)
- `MapLibreRendererAdapter.ts` — `focusPlaceAt`, `setSelectedPlaceMarkerId`
- `MapLibreMapSurface.tsx` — mounts `MapLibrePlacesLayer`
- `runtime/controller.ts` — layer toggles, sheet open on select, filtered markers, camera focus
- `experience.ts`, `world/index.ts`, `app/world.tsx`, `WorldExperienceShell.tsx`

### Deleted
- `MapLibrePlacesMarkers.tsx` (replaced by `MapLibrePlacesLayer.tsx`)

## Migrations created

None.

## Security review

- Demo places only; no paid geo vendor.
- UI imports view-state types only — no MapLibre / provider imports.
- Metric placeholders are explicitly `null` (no fabricated population/users/etc.).
- Unbound / empty provider remains fail-closed.

## Tests

**245/245 PASS** (`npm test -- --run`)

## TypeScript

**PASS** (`npx tsc --noEmit`)

## Build

Not run (EAS APK not requested for this task).

## git diff --check

PASS.

## git status --short

Untracked `build.json*` left untouched. Local `docs/` updated for handoff.

## Open issues

- Device APK preview recommended to verify cluster/label/sheet UX on hardware.
- Country/State kinds remain in registry; demo set is City/Capital tiers only.
