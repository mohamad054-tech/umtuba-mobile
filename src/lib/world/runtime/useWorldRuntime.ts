import { useEffect, useMemo, useReducer, useRef } from "react";

import {
  createWorldRuntimeController,
  WorldRuntimeController,
} from "@/src/lib/world/runtime/controller";
import type { WorldRuntimeControllerOptions } from "@/src/lib/world/runtime/types";

/**
 * React binding — World screen must use this (or an injected controller),
 * not local load/retry state machines.
 */
export function useWorldRuntime(options?: WorldRuntimeControllerOptions): {
  controller: WorldRuntimeController;
} {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const controller = useMemo(
    () => createWorldRuntimeController(optionsRef.current),
    []
  );

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
