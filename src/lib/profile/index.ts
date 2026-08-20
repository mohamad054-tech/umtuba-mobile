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
