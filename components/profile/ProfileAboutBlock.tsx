import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import type { ProfileTranslate } from "@/components/profile/profileUi";
import type { AppLocale } from "@/src/lib/i18n/locales";
import { localeTextAlign, localeWritingDirection } from "@/src/lib/i18n/rtl";
import type { ProfilePresentation } from "@/src/lib/profile/presentation";
import type { ProfileAboutExtras } from "@/src/lib/profile/profileAbout";
import {
  formatWebsiteLabel,
  normalizeHeroSocialLinks,
  shouldShowHeroSocialLinks,
  shouldShowHeroWebsite,
  toExternalHref,
} from "@/src/lib/profile/profileHeroSocialLinks";
import {
  normalizeAchievementMedals,
  shouldShowIdentityAchievements,
} from "@/src/lib/profile/profileIdentityAchievements";
import {
  formatAboutJoinedBody,
  formatJoinedMonthYear,
} from "@/src/lib/profile/profileJoinedLabel";
import { colors } from "@/src/theme/colors";

type ProfileAboutBlockProps = {
  view: ProfilePresentation;
  locale: AppLocale;
  t: ProfileTranslate;
  about: ProfileAboutExtras;
  isOwn: boolean;
};

export default function ProfileAboutBlock({
  view,
  locale,
  t,
  about,
  isOwn,
}: ProfileAboutBlockProps) {
  const textAlign = localeTextAlign(locale);
  const direction = localeWritingDirection(locale);
  const joinedDate = formatAboutJoinedBody(
    formatJoinedMonthYear(view.createdAt, locale)
  );
  const joinedLine = joinedDate
    ? t("profile.joinedLine", { values: { date: joinedDate } })
    : null;
  const websiteHref = toExternalHref(about.website);
  const websiteLabel = formatWebsiteLabel(about.website);
  const socialLinks = normalizeHeroSocialLinks(about.links);
  const medals = normalizeAchievementMedals(about.achievements);
  const hasDetails = Boolean(
    view.bio ||
      view.locationLine ||
      joinedLine ||
      (isOwn && view.email) ||
      shouldShowHeroWebsite(about.website) ||
      shouldShowHeroSocialLinks(about.links) ||
      shouldShowIdentityAchievements(about.achievements)
  );

  if (!hasDetails) {
    return (
      <Text style={[styles.muted, { textAlign }]}>{t("profile.aboutEmpty")}</Text>
    );
  }

  return (
    <View style={[styles.block, { direction }]}>
      {view.bio ? (
        <Text style={[styles.body, { textAlign }]}>{view.bio}</Text>
      ) : null}
      {view.locationLine ? (
        <Text style={[styles.meta, { textAlign }]}>{view.locationLine}</Text>
      ) : null}
      {joinedLine ? (
        <Text style={[styles.meta, { textAlign }]}>{joinedLine}</Text>
      ) : null}
      {isOwn && view.email ? (
        <Text
          style={[styles.meta, { textAlign }]}
          accessibilityLabel={t("profile.emailA11y", {
            values: { email: view.email },
          })}
        >
          {view.email}
        </Text>
      ) : null}
      {shouldShowHeroWebsite(about.website) && websiteHref && websiteLabel ? (
        <Pressable
          onPress={() => void Linking.openURL(websiteHref)}
          accessibilityRole="link"
          accessibilityLabel={websiteLabel}
        >
          <Text style={[styles.link, { textAlign }]}>{websiteLabel}</Text>
        </Pressable>
      ) : null}
      {shouldShowHeroSocialLinks(about.links) ? (
        <View accessibilityLabel={t("profile.socialLinks")}>
          {socialLinks.map((link) => (
            <Pressable
              key={link.href}
              onPress={() => void Linking.openURL(link.href)}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              style={styles.linkRow}
            >
              <Text style={styles.link}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {shouldShowIdentityAchievements(about.achievements) ? (
        <View accessibilityLabel={t("profile.achievements")}>
          {medals.visible.map((label) => (
            <Text key={label} style={[styles.meta, { textAlign }]}>
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 20,
    gap: 8,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    color: colors.textSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    color: colors.textMuted,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  link: {
    color: colors.accentCyan,
    fontWeight: "700",
    fontSize: 14,
  },
  linkRow: {
    minHeight: 44,
    justifyContent: "center",
  },
});
