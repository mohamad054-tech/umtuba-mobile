import {
  useGlobalSearchParams,
  usePathname,
  useSegments,
} from "expo-router";
import { useEffect } from "react";

import { noteWatchNavPath } from "./watchRootExit";

/**
 * Remembers the surface Watch was entered from so double-back can
 * return there. Nested Profile / secondary routes do not overwrite it.
 */
export function WatchEntryTracker() {
  const pathname = usePathname();
  const segments = useSegments();
  const query = useGlobalSearchParams();

  useEffect(() => {
    noteWatchNavPath({
      path: pathname,
      segments,
      query,
    });
  }, [pathname, query, segments]);

  return null;
}
