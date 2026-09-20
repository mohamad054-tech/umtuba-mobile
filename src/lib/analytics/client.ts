import {
  ANALYTICS_EVENTS,
  captureAnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsEventProps,
} from "./events";

export { ANALYTICS_EVENTS, captureAnalyticsEvent };
export type { AnalyticsEventName, AnalyticsEventProps };
import { readPosthogPublicConfig } from "./posthogEnv";

type PosthogLike = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
  shutdown?: () => Promise<void> | void;
};

let client: PosthogLike | null = null;
let initAttempted = false;

function isAnalyticsDisabled(): boolean {
  return !readPosthogPublicConfig().enabled;
}

export function resetAnalyticsClientForTests(): void {
  client = null;
  initAttempted = false;
}

export function isAnalyticsEnabled(): boolean {
  return readPosthogPublicConfig().enabled;
}

export async function initAnalytics(): Promise<boolean> {
  if (initAttempted) return client != null;
  initAttempted = true;
  const config = readPosthogPublicConfig();
  if (!config.enabled) {
    client = null;
    return false;
  }
  try {
    const { default: PostHog } = await import("posthog-react-native");
    client = new PostHog(config.key, {
      host: config.host,
      enableSessionReplay: false,
      captureAppLifecycleEvents: true,
      disabled: false,
    }) as PosthogLike;
    return true;
  } catch (error) {
    console.warn("PostHog init skipped:", error);
    client = null;
    return false;
  }
}

export function identifyAnalyticsUser(userId: string | null | undefined): void {
  if (!client || !userId) return;
  client.identify(userId);
}

export function resetAnalyticsUser(): void {
  client?.reset();
}

export function track<E extends AnalyticsEventName>(
  name: E,
  props: AnalyticsEventProps[E]
): void {
  if (!client) return;
  captureAnalyticsEvent(name, props, (event, properties) => {
    client?.capture(event, properties);
  });
}

export function trackAppOpened(): void {
  let platform: "android" | "ios" | "web" | "unknown" = "unknown";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native") as {
      Platform?: { OS?: string };
    };
    const os = Platform?.OS;
    if (os === "android" || os === "ios" || os === "web") platform = os;
  } catch {
    platform = "unknown";
  }
  track(ANALYTICS_EVENTS.app_opened, { platform });
}

export function getAnalyticsClientForTests(): PosthogLike | null {
  return client;
}

export function setAnalyticsClientForTests(next: PosthogLike | null): void {
  client = next;
  initAttempted = next != null;
}
