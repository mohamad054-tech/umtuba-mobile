# CURSOR_REPORT — World Users Layer V1

## Summary

Privacy-safe Users layer via World Data Pipeline: approximate city pins, no email/phone, mapVisible filter, clustering, independent layer toggle, search by display name/handle, bottom sheet with placeholder social actions. Cities/Education unaffected. Fail-closed when provider missing.

## Exact files changed

### New
- `src/lib/world/users/*`
- `src/lib/world/renderer/maplibre/MapLibreUsersLayer.tsx`
- `components/world/WorldUserBottomSheet.tsx`

### Modified
- dataPipeline types/providers/tests
- runtime/controller.ts
- experience.ts, categories.ts, world/index.ts, world.test.ts
- search types/service/tests
- MapLibreRendererAdapter, MapLibreMapSurface
- WorldExperienceShell, WorldSearchBar

## Migrations created

None.

## Security review

- Approximate coords only (rounded); hidden users omitted.
- No email/phone in public contract; handle email-shaped values rejected.
- Social actions disabled placeholders.
- UI does not import providers/MapLibre.

## Tests

**PASS** (full suite)

## TypeScript

**PASS**

## git diff --check

PASS.
