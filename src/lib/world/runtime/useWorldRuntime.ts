import { useEffect, useMemo, useReducer, useRef } from "react";

import { createMapLibreRendererAdapter } from "@/src/lib/world/renderer";
import {
  createWorldRuntimeController,
  WorldRuntimeController,
} from "@/src/lib/world/runtime/controller";
import type { WorldRuntimeControllerOptions } from "@/src/lib/world/runtime/types";

/**
 * React binding — World screen must use this (or an injected controller),
 * not local load/retry state machines.
 *
 * Default renderer: MapLibre via Renderer Adapter only (UI never imports MapLibre).
 */
export function useWorldRuntime(options?: WorldRuntimeControllerOptions): {
  controller: WorldRuntimeController;
} {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const controller = useMemo(() => {
    const incoming = optionsRef.current;
    return createWorldRuntimeController({
      ...incoming,
      // Inject MapLibre unless the caller supplies an explicit renderer (tests).
      renderer:
        incoming?.renderer !== undefined
          ? incoming.renderer
          : createMapLibreRendererAdapter(),
    });
  }, []);

  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    return controller.subscribe(() => {
      bump();
    });
  }, [controller]);

  useEffect(() => {
    void controller.start();
  }, [controller]);

  return { controller };
}
