import type { TranslationKey } from "./messages/types";

export const REPORT_REASON_KEYS = {
  spam: "report.reason.spam",
  harassment: "report.reason.harassment",
  hate: "report.reason.hate",
  sexual: "report.reason.sexual",
  violence: "report.reason.violence",
  illegal: "report.reason.illegal",
  impersonation: "report.reason.impersonation",
  other: "report.reason.other",
} as const satisfies Record<string, TranslationKey>;

export const DISCOVER_CATEGORY_KEYS = {
  watch: "discover.category.watch",
  live: "discover.category.live",
  learning: "discover.category.learning",
  games: "discover.category.games",
  communities: "discover.category.communities",
  events: "discover.category.events",
} as const satisfies Record<string, TranslationKey>;

export const DISCOVER_SECTION_TITLE_KEYS = {
  latest: "discover.section.latest",
  trending: "discover.section.trending",
  recommended: "discover.section.recommended",
} as const satisfies Record<string, TranslationKey>;

export const DISCOVER_SECTION_MESSAGE_KEYS = {
  latest: "discover.section.latestEmpty",
  trending: "discover.section.trendingEmpty",
  recommended: "discover.section.recommendedBody",
  people: "discover.peopleSoon",
  hashtags: "discover.hashtagsSoon",
} as const satisfies Record<string, TranslationKey>;

export const NOTIFICATION_CATEGORY_KEYS = {
  social: "notifications.category.social",
  messages: "notifications.category.messages",
  watch: "notifications.category.watch",
  learning: "notifications.category.learning",
  games: "notifications.category.games",
  system: "notifications.category.system",
} as const satisfies Record<string, TranslationKey>;

export const WORLD_KIND_KEYS = {
  places: "world.kind.place",
  education: "world.kind.education",
  users: "world.kind.user",
  commerce: "world.kind.commerce",
  events: "world.kind.event",
  games: "world.kind.game",
} as const satisfies Record<string, TranslationKey>;

export const WORLD_CATEGORY_KEYS = {
  cities: "world.category.places",
  education: "world.category.education",
  users: "world.category.users",
  games: "world.category.games",
  businesses: "world.category.commerce",
  events: "world.category.events",
  ai: "world.category.ai",
  future: "world.category.future",
} as const satisfies Record<string, TranslationKey>;

export const LIVE_STATUS_KEYS = {
  live: "live.status.live",
  scheduled: "live.status.scheduled",
  ended: "live.status.ended",
  cancelled: "live.status.cancelled",
  unavailable: "live.status.unavailable",
} as const satisfies Record<string, TranslationKey>;

export const MESSAGE_RECEIPT_KEYS = {
  sent: "messages.receipt.sent",
  delivered: "messages.receipt.delivered",
  seen: "messages.receipt.seen",
} as const satisfies Record<string, TranslationKey>;
