import { SUPPORT_LINKS } from "@/src/lib/settings/supportLinks";
import { canAcceptTerms } from "@/src/lib/safety/ugcPolicy";

/** Required App Store / Play UGC acknowledgment before a first publish. */
export const UGC_PUBLISH_ACK_LABEL =
  "I confirm this video follows UMTUBA Terms and community rules and does not include objectionable content.";

export const UGC_TERMS_URL = SUPPORT_LINKS.terms;

export function canPublishWithUgcAck(acknowledged: boolean): boolean {
  return canAcceptTerms(acknowledged);
}
