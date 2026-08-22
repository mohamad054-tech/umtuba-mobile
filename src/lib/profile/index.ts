export {
  buildProfilePresentation,
  type ProfilePresentation,
} from "@/src/lib/profile/presentation";
export {
  parseProfileUserId,
  planOtherProfileLookup,
  resolveProfileTarget,
  type OtherProfileLookupPlan,
  type ProfileTarget,
} from "@/src/lib/profile/resolveTarget";
export { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";
export {
  STACKED_PROFILE_PATH,
  buildStackedProfileHref,
  parseProfileNavOrigin,
  profileOriginFallbackHref,
  type ProfileNavOrigin,
} from "@/src/lib/profile/profileNav";
export {
  FOLLOW_LIST_PATHS,
  STACKED_MEMBER_PROFILE_PATH,
  buildFollowListHref,
  buildFollowListMemberProfileHref,
  followListOwnerFallbackHref,
  isStackedMemberProfilePath,
  parseFollowListKind,
} from "@/src/lib/profile/followListNav";
export {
  listProfileVideos,
  mapProfileVideoRow,
  type ProfileVideoItem,
} from "@/src/lib/profile/listProfileVideos";
export {
  listProfilePosts,
  mapProfilePostRow,
  type ProfilePostItem,
} from "@/src/lib/profile/listProfilePosts";
export {
  buildProfileTimeline,
  type ProfileTimelineItem,
} from "@/src/lib/profile/buildProfileTimeline";
export {
  FOLD6_FOLDED_WIDTH_DP,
  FOLD6_UNFOLDED_WIDTH_DP,
  PROFILE_AVATAR_SIZE_DP,
  PROFILE_COVER_HEIGHT_DP,
  PROFILE_LARGE_SCREEN_MIN_WIDTH,
  PROFILE_MEDIA_MAX_HEIGHT_DP,
  PROFILE_MEDIA_NARROW_ASPECT,
  PROFILE_MEDIA_RESIZE_MODE,
  PROFILE_MEDIA_WIDE_ASPECT,
  PROFILE_POST_CARD_PADDING_DP,
  PROFILE_READABLE_MAX_WIDTH,
  PROFILE_TIMELINE_GUTTER_DP,
  containedFrameFitsBox,
  isProfileLargeScreen,
  resolveProfileContentWidth,
  resolveProfileMediaAspect,
  resolveProfileMediaBox,
  resolveProfileMediaInnerWidth,
  type ProfileMediaBox,
} from "@/src/lib/profile/profileLayout";
export {
  formatAboutJoinedBody,
  formatJoinedMonthYear,
  stripJoinedPrefix,
} from "@/src/lib/profile/profileJoinedLabel";
export {
  getVisibleMobileProfileTabs,
  parseMobileProfileTab,
  resolveActiveMobileProfileTab,
  type MobileProfileTabId,
} from "@/src/lib/profile/profileTabs";
export { emptyProfileAboutExtras } from "@/src/lib/profile/profileAbout";
export { buildProfileShareUrl } from "@/src/lib/profile/profileShareUrl";
