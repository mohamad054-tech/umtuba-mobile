import { useEffect, useRef } from "react";

import { useAuth } from "@/src/lib/auth/AuthContext";

import {
  identifyAnalyticsUser,
  initAnalytics,
  resetAnalyticsUser,
  trackAppOpened,
} from "./client";

export function PostHogRoot() {
  const { user } = useAuth();
  const openedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void initAnalytics().then((ok) => {
      if (cancelled || !ok || openedRef.current) return;
      openedRef.current = true;
      trackAppOpened();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      identifyAnalyticsUser(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      resetAnalyticsUser();
    }
  }, [user]);

  return null;
}
