# CURSOR_REPORT — World Education Layer V1

## Summary

First real Education layer on UM World via World Data Pipeline. Demo Education Provider supplies University / School / Learning Center pins. Runtime loads via Pipeline → EducationRegistry → MapLibre education markers (violet, distinct from cyan cities). Independent layer toggle; bottom sheet shows name/type/city with null Programs/Students/Courses placeholders. Fail-closed when education provider missing.

## Exact files changed

### New
- `src/lib/world/education/*` (types, registry, layer, sheet, tests)
- `src/lib/world/renderer/maplibre/MapLibreEducationLayer.tsx`
- `components/world/WorldEducationBottomSheet.tsx`

### Modified
- `dataPipeline/types.ts`, `providers.ts`, `index.ts`, `dataPipeline.test.ts`
- `runtime/controller.ts`
- `experience.ts`, `categories.ts`, `world/index.ts`, `world.test.ts`
- `MapLibreRendererAdapter.ts`, `MapLibreMapSurface.tsx`
- `WorldExperienceShell.tsx`

## Migrations created

None.

## Security review

- Demo education only; no invented Programs/Students/Courses values.
- UI does not import providers or MapLibre.
- Missing education provider → empty markers; Cities continue.

## Tests

**265+/PASS** (full suite)

## TypeScript

**PASS**

## Build

Not run.

## git diff --check

PASS.

## Open issues

- Device APK recommended to verify violet education markers vs cyan cities.
- Education markers are circle-based (violet) for MapLibre simplicity; not literal squares.
