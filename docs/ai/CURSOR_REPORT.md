# Cursor Report — World Product Surface Hardening V1

## Summary

Hardened UM World product surface without changing Runtime / Data Pipeline / Renderer Adapter architecture and without adding Globe. Defaults: Streets map source + Places/Cities layer on. Collapsible Map settings for Sources/Roads/Buildings; Search + Layers always visible; larger map chrome. Bottom sheets show real fields only (no Coming soon / dead CTAs). Unsupported Globe and AI/Future stubs hidden from product UI. Development/debug copy removed from renderer host.

## Exact files changed

### New
- `components/world/WorldMapSettingsPanel.tsx`
- `src/lib/world/productSurface.test.ts`

### Modified
- `app/world.tsx`
- `components/world/WorldExperienceShell.tsx`
- `components/world/WorldHeader.tsx`
- `components/world/WorldRendererHost.tsx`
- `components/world/WorldCameraControls.tsx`
- `components/world/WorldControls.tsx`
- `components/world/WorldSearchBar.tsx`
- `components/world/World*BottomSheet.tsx` (all six)
- `src/lib/world/categories.ts`
- `src/lib/world/experience.ts`
- `src/lib/world/experience.test.ts`
- `src/lib/world/world.test.ts`
- `src/lib/world/mapSource/registry.ts`
- `src/lib/world/mapSource/mapSource.test.ts`
- `src/lib/world/runtime/controller.ts` (default preferred Streets only)
- `src/lib/world/runtime/stateMachine.ts` (product-facing messages)
- `src/lib/world/*/ *Sheet.ts` (places/education/users/games/commerce/events)
- Domain tests + `renderer/globe.test.ts`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None.

## Security review

- No secrets / `.env` changes.
- Users privacy model unchanged.
- Demo map source retained for fail-closed fallback only; not shown in product source chips.

## Tests

**367/367 PASS** (44 files)

## TypeScript

**PASS** (`npx tsc --noEmit`)

## Build

Not run (EAS Build deferred per task note).

## git diff --check

**PASS**

## git status --short

(see after commit)

## Open issues

- Demo data providers still power the pipeline (product chrome no longer advertises demo).
- Sheet actions remain deferred until trusted product surfaces exist.
- Globe dual-surface still not implemented (intentionally deferred).
