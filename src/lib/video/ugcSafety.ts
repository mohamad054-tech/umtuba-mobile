import { SUPPORT_LINKS } from "@/src/lib/settings/supportLinks";

/** Required App Store UGC acknowledgment before a first publish. */
export const UGC_PUBLISH_ACK_LABEL =
  "I confirm this video follows UMTUBA Terms and does not include objectionable content.";

export const UGC_TERMS_URL = SUPPORT_LINKS.terms;

/** Visible checkbox box (was 22×22 / 1px low-contrast border). */
export const CREATE_ACK_CHECKBOX_SIZE = 28;
export const CREATE_ACK_CHECKBOX_BORDER_WIDTH = 2.5;
export const CREATE_ACK_TOUCH_MIN_HEIGHT = 48;
export const CREATE_ACK_CHECK_MARK = "✓";

export function canPublishWithUgcAck(acknowledged: boolean): boolean {
  return acknowledged === true;
}
