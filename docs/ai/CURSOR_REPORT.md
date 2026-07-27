# CURSOR_REPORT — World Commerce Layer V1

## Summary

Added a full Commerce (Businesses) layer mirroring the Games/Users/Education pattern: `Runtime -> WorldDataPipeline -> CommerceRegistry -> Renderer`, with demo commerce data (5 published/map-visible types + 1 hidden draft), independent `businesses` category toggle (pipeline kind remains `commerce`), coral/red clustered markers via `colors.danger`, search integration, and a dedicated commerce bottom sheet with placeholder meta/actions only.

## Exact files changed

- `components/world/WorldCommerceBottomSheet.tsx` (new)
- `components/world/WorldExperienceShell.tsx`
- `components/world/WorldSearchBar.tsx`
- `docs/ai/CURSOR_REPORT.md`
- `src/lib/world/categories.ts`
- `src/lib/world/commerce/commerce.test.ts` (new)
- `src/lib/world/commerce/commerceLayer.ts` (new)
- `src/lib/world/commerce/commerceSheet.ts` (new)
- `src/lib/world/commerce/index.ts` (new)
- `src/lib/world/commerce/registry.ts` (new)
- `src/lib/world/commerce/types.ts` (new)
- `src/lib/world/dataPipeline/dataPipeline.test.ts`
- `src/lib/world/dataPipeline/index.ts`
- `src/lib/world/dataPipeline/providers.ts`
- `src/lib/world/dataPipeline/types.ts`
- `src/lib/world/experience.ts`
- `src/lib/world/index.ts`
- `src/lib/world/renderer/maplibre/MapLibreCommerceLayer.tsx` (new)
- `src/lib/world/renderer/maplibre/MapLibreMapSurface.tsx`
- `src/lib/world/renderer/maplibre/MapLibreRendererAdapter.ts`
- `src/lib/world/renderer/renderer.test.ts`
- `src/lib/world/runtime/controller.ts`
- `src/lib/world/search/search.test.ts`
- `src/lib/world/search/types.ts`
- `src/lib/world/search/worldSearchService.ts`
- `src/lib/world/world.test.ts`

## Migrations created

None.

## Security review

- No phone, email, prices, ratings, or private address data in demo records or sheets.
- `normalizeWorldCommerceRecord` rejects unpublished rows, `mapVisible: false`, invalid types, and email/phone-shaped `brandName` values (fail-closed).
- No direct UI access to providers or MapLibre internals.
- Missing commerce provider yields `[]` data without crashing other layers.

## Tests

PASS (`npm test`) — **296/296** tests passed.

## TypeScript

PASS (`npx tsc --noEmit`).

## Build

Not run (not required for this feature scope).

## git diff --check

PASS.

## git status --short

Modified feature files listed above; new `src/lib/world/commerce/` module and `MapLibreCommerceLayer.tsx` / `WorldCommerceBottomSheet.tsx`. Pre-existing untracked local files (`build.json*`, other `docs/ai/*.md`) untouched.

## Open issues

None identified in feature scope.
