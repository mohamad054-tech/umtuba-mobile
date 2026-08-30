export const EMAIL_FIND_VALUES = ["nobody", "everyone"] as const;
export const PHONE_FIND_VALUES = ["nobody", "contacts", "everyone"] as const;

export type EmailFindValue = (typeof EMAIL_FIND_VALUES)[number];
export type PhoneFindValue = (typeof PHONE_FIND_VALUES)[number];

export const DEFAULT_EMAIL_FIND: EmailFindValue = "nobody";
export const DEFAULT_PHONE_FIND: PhoneFindValue = "nobody";

export function effectivePhoneFind(
  value: PhoneFindValue
): "nobody" | "everyone" {
  return value === "everyone" ? "everyone" : "nobody";
}

export type DiscoveredIdentity = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};
