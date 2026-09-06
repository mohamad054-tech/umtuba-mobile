import { detectUmStreakLocale, type UmStreakLocale } from "./locale";
import type { UmStreakState } from "./types";

export const UM_STREAK_COPY = {
  en: {
    title: "UM Streak",
    camera: "Open camera",
    capture: "Capture",
    send: "Send visual",
    sending: "Sending…",
    captionPlaceholder: "Add a short caption (optional)",
    viewOnce: "View once",
    opened: "Opened",
    activeToday: "Active today",
    waitingForFriend: "Waiting for your friend",
    youStillNeedToReply: "Your turn today",
    atRisk: "Keep it going today",
    started: "Streak started",
    selectFriends: "Send to friends",
    photo: "Photo",
    video: "Video",
    closeCamera: "Close camera",
    flipCamera: "Flip camera",
    library: "Library",
    notPublic: "Private to Messages. Not a UM Life post.",
    badges: "UM Streak badges",
    badge3: "3 days",
    badge7: "7 days",
    badge30: "30 days",
    badge100: "100 days",
    badge365: "365 days",
    cameraUnavailable: "Camera is not available. Use the library instead.",
    cameraPermission:
      "UMTUBA needs camera access so you can send a private UM Streak photo or video in Messages.",
    microphonePermission:
      "UMTUBA needs microphone access so you can record a private UM Streak video in Messages.",
    stopRecording: "Stop recording",
    longest: "Longest",
    broken: "Streak ended",
    livePreview: "Live camera preview",
    capturedPhoto: "Captured photo",
    capturedVideo: "Captured video",
    visualReply: "Visual reply",
    blocked: "You cannot send a visual message to this person.",
    openFailed: "This visual message is not available.",
    sendFailed: "Unable to send visual message.",
    uploadFailed: "Unable to upload visual message.",
    pickRecipient: "Choose at least one conversation.",
    signIn: "Please sign in to send a visual message.",
    keepInChat: "Keep in chat",
    retentionChoice: "How should this visual stay?",
    cameraDenied: "Camera permission is required for live preview. Use Library or allow camera access.",
    previewFailed: "Live camera preview is unavailable on this device. You can still capture or use Library.",
    mediaLoadFailed: "This visual could not be displayed. Tap to try again.",
  },
  ar: {
    title: "UM Streak",
    camera: "افتح الكاميرا",
    capture: "التقط",
    send: "أرسل بصرياً",
    sending: "جارٍ الإرسال…",
    captionPlaceholder: "أضف تعليقاً قصيراً (اختياري)",
    viewOnce: "عرض مرة واحدة",
    opened: "تم الفتح",
    activeToday: "نشط اليوم",
    waitingForFriend: "بانتظار صديقك",
    youStillNeedToReply: "دورك اليوم",
    atRisk: "أكمل اليوم لتستمر",
    started: "بدأ التتابع",
    selectFriends: "أرسل إلى الأصدقاء",
    photo: "صورة",
    video: "فيديو",
    closeCamera: "أغلق الكاميرا",
    flipCamera: "اقلب الكاميرا",
    library: "المكتبة",
    notPublic: "خاص بالرسائل. ليس منشوراً على UM Life.",
    badges: "شارات UM Streak",
    badge3: "3 أيام",
    badge7: "7 أيام",
    badge30: "30 يوماً",
    badge100: "100 يوم",
    badge365: "365 يوماً",
    cameraUnavailable: "الكاميرا غير متاحة. استخدم المكتبة.",
    cameraPermission:
      "تحتاج UMTUBA إلى الكاميرا لإرسال صورة أو فيديو خاص في الرسائل عبر UM Streak.",
    microphonePermission:
      "تحتاج UMTUBA إلى الميكروفون لتسجيل فيديو خاص في الرسائل عبر UM Streak.",
    stopRecording: "إيقاف التسجيل",
    longest: "الأطول",
    broken: "انتهى التتابع",
    livePreview: "معاينة الكاميرا المباشرة",
    capturedPhoto: "صورة ملتقطة",
    capturedVideo: "فيديو ملتقط",
    visualReply: "رد بصري",
    blocked: "لا يمكنك إرسال رسالة بصرية إلى هذا الشخص.",
    openFailed: "هذه الرسالة البصرية غير متاحة.",
    sendFailed: "تعذّر إرسال الرسالة البصرية.",
    uploadFailed: "تعذّر رفع الرسالة البصرية.",
    pickRecipient: "اختر محادثة واحدة على الأقل.",
    signIn: "يرجى تسجيل الدخول لإرسال رسالة بصرية.",
    keepInChat: "الاحتفاظ في المحادثة",
    retentionChoice: "كيف يبقى هذا المحتوى؟",
    cameraDenied: "معاينة الكاميرا تحتاج إذناً. استخدم المكتبة أو اسمح للكاميرا.",
    previewFailed: "معاينة الكاميرا المباشرة غير متاحة على هذا الجهاز. يمكنك الالتقاط أو استخدام المكتبة.",
    mediaLoadFailed: "تعذّر عرض هذا المحتوى. اضغط للمحاولة مرة أخرى.",
  },
} as const;

export type UmStreakCopyKey = keyof (typeof UM_STREAK_COPY)["en"];

export function umStreakText(
  key: UmStreakCopyKey,
  locale?: UmStreakLocale
): string {
  const resolved = locale ?? detectUmStreakLocale();
  return UM_STREAK_COPY[resolved][key] ?? UM_STREAK_COPY.en[key];
}

export function umStreakStateLabel(
  state: UmStreakState,
  locale?: UmStreakLocale
): string {
  switch (state) {
    case "started":
      return umStreakText("started", locale);
    case "active_today":
      return umStreakText("activeToday", locale);
    case "waiting_for_friend":
      return umStreakText("waitingForFriend", locale);
    case "you_need_to_reply":
      return umStreakText("youStillNeedToReply", locale);
    case "at_risk":
      return umStreakText("atRisk", locale);
    case "broken":
      return umStreakText("broken", locale);
    default:
      return umStreakText("title", locale);
  }
}

export function umStreakBadgeLabel(
  days: 3 | 7 | 30 | 100 | 365,
  locale?: UmStreakLocale
): string {
  switch (days) {
    case 3:
      return umStreakText("badge3", locale);
    case 7:
      return umStreakText("badge7", locale);
    case 30:
      return umStreakText("badge30", locale);
    case 100:
      return umStreakText("badge100", locale);
    case 365:
      return umStreakText("badge365", locale);
  }
}
