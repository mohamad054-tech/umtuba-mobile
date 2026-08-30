const EN = {
  startConversation: "Start conversation",
  startTitle: "Start a conversation",
  startIntro:
    "Find someone by username, email, phone, or their personal UMTUBA link.",
  tabUsername: "Username",
  tabEmail: "Email",
  tabPhone: "Phone",
  tabLink: "Link & QR",
  usernamePlaceholder: "@username",
  emailPlaceholder: "name@example.com",
  phonePlaceholder: "+12025550123",
  linkPlaceholder: "umtuba.com/@username",
  lookup: "Find",
  looking: "Looking…",
  message: "Message",
  notFound: "No UMTUBA account is available to message with this lookup.",
  inviteBoundary:
    "UMTUBA does not send invites for you. Share your personal link if you want to be found.",
  yourLink: "Your link",
  yourQr: "Your QR",
  scanHint: "Scanning a QR is not enabled yet. Share or paste a personal link.",
  closeStart: "Close",
  identityFound: "Start a conversation with this person.",
  contactsFoundation:
    "UMTUBA never reads or uploads your address book. Contact matching is not enabled yet.",
  contactsAllow: "Remember that I agreed to contact matching later",
  contactsRevoke: "Forget contact-matching permission",
  contactsSaved: "Permission noted. No contacts were uploaded.",
  contactsRevoked: "Permission forgotten. No contacts were stored.",
  opening: "Opening conversation…",
} as const;

const AR: { [K in keyof typeof EN]: string } = {
  startConversation: "بدء محادثة",
  startTitle: "بدء محادثة",
  startIntro: "ابحث باسم المستخدم أو البريد أو الهاتف أو رابط أمتوبة الشخصي.",
  tabUsername: "اسم المستخدم",
  tabEmail: "البريد",
  tabPhone: "الهاتف",
  tabLink: "الرابط والرمز",
  usernamePlaceholder: "@username",
  emailPlaceholder: "name@example.com",
  phonePlaceholder: "+12025550123",
  linkPlaceholder: "umtuba.com/@username",
  lookup: "بحث",
  looking: "جارٍ البحث…",
  message: "رسالة",
  notFound: "لا يوجد حساب أمتوبة متاح للمراسلة بهذا البحث.",
  inviteBoundary:
    "أمتوبة لا ترسل دعوات نيابة عنك. شارك رابطك الشخصي إن أردت أن يُعثر عليك.",
  yourLink: "رابطك",
  yourQr: "رمزك",
  scanHint: "مسح الرمز غير متاح بعد. شارك الرابط الشخصي أو الصقه.",
  closeStart: "إغلاق",
  identityFound: "ابدأ محادثة مع هذا الشخص.",
  contactsFoundation:
    "أمتوبة لا تقرأ دفتر جهات الاتصال ولا ترفعه. المطابقة غير مفعّلة بعد.",
  contactsAllow: "تذكّر موافقتي على مطابقة جهات الاتصال لاحقاً",
  contactsRevoke: "انسَ إذن مطابقة جهات الاتصال",
  contactsSaved: "تم تسجيل الإذن. لم يُرفع أي دفتر جهات اتصال.",
  contactsRevoked: "تم نسيان الإذن. لم تُخزَّن جهات اتصال.",
  opening: "جارٍ فتح المحادثة…",
};

export type CommsCopy = { [K in keyof typeof EN]: string };

export function commsCopyForRtl(isRtl: boolean): CommsCopy {
  return isRtl ? AR : EN;
}

export function commsCopy(isRtl = false): CommsCopy {
  return commsCopyForRtl(isRtl);
}
