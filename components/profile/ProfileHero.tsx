import { useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { ProfileTranslate } from "@/components/profile/profileUi";
import type { AppLocale } from "@/src/lib/i18n/locales";
import {
  localeTextAlign,
  localeWritingDirection,
} from "@/src/lib/i18n/rtl";
import type { ProfilePresentation } from "@/src/lib/profile/presentation";
import type { ProfileAboutExtras } from "@/src/lib/profile/profileAbout";
import { bioNeedsExpandToggle } from "@/src/lib/profile/profileHeroCompleteness";
import { normalizeSpecialtyChips } from "@/src/lib/profile/profileHeroCompleteness";
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
  normalizeInterestTeasers,
  normalizeRoleChips,
  shouldShowIdentityStrip,
} from "@/src/lib/profile/profileIdentityStrip";
import {
  formatAboutJoinedBody,
  formatJoinedMonthYear,
} from "@/src/lib/profile/profileJoinedLabel";
import {
  PROFILE_AVATAR_SIZE_DP,
  PROFILE_COVER_HEIGHT_DP,
} from "@/src/lib/profile/profileLayout";
import { colors } from "@/src/theme/colors";

type ProfileHeroProps = {
  view: ProfilePresentation;
  locale: AppLocale;
  t: ProfileTranslate;
  about: ProfileAboutExtras;
  windowWidth: number;
  isOwn: boolean;
  onOpenAbout?: () => void;
};

export default function ProfileHero({
  view,
  locale,
  t,
  about,
  windowWidth,
  isOwn,
  onOpenAbout,
}: ProfileHeroProps) {
  const textAlign = localeTextAlign(locale);
  const direction = localeWritingDirection(locale);
  const [bioExpanded, setBioExpanded] = useState(false);
  const canExpandBio = bioNeedsExpandToggle(view.bio);
  const joinedDate = formatAboutJoinedBody(
    formatJoinedMonthYear(view.createdAt, locale)
  );
  const joinedLine = joinedDate
    ? t("profile.joinedLine", { values: { date: joinedDate } })
    : null;
  const specialtyChips = normalizeSpecialtyChips(about.specialties);
  const websiteHref = toExternalHref(about.website);
  const websiteLabel = formatWebsiteLabel(about.website);
  const socialLinks = normalizeHeroSocialLinks(about.links);
  const medals = normalizeAchievementMedals(about.achievements);
  const roles = normalizeRoleChips(about.roles);
  const interests = normalizeInterestTeasers(about.interests);
  const showIdentityStrip = shouldShowIdentityStrip({
    roles: about.roles,
    interests: about.interests,
  });

  return (
    <View>
      <View
        style={[styles.cover, { width: windowWidth }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[StyleSheet.absoluteFill, styles.coverBase]} />
        <View style={styles.coverOrbStart} />
        <View style={styles.coverOrbEnd} />
        <View style={styles.coverFade} />
      </View>

      <View
        style={styles.avatar}
        accessibilityLabel={
          view.hasReliableIdentity
            ? t("profile.avatarFor", {
                values: {
                  name: view.displayName || view.username || t("profile.you"),
                },
              })
            : t("profile.avatarPlaceholder")
        }
      >
        {view.avatarUrl ? (
          <Image
            source={{ uri: view.avatarUrl }}
            style={styles.avatarImage}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={styles.avatarText} accessible={false}>
            {view.avatarInitial}
          </Text>
        )}
      </View>

      <View style={[styles.identity, { direction }]}>
        <Text style={[styles.eyebrow, { textAlign }]}>
          {t("profile.creatorSpace")}
        </Text>
        {view.hasReliableIdentity ? (
          <>
            <Text style={[styles.name, { textAlign }]} accessibilityRole="header">
              {view.displayName || view.username || t("profile.account")}
            </Text>
            {view.username ? (
              <Text style={[styles.username, { textAlign }]}>@{view.username}</Text>
            ) : null}
            {specialtyChips.length > 0 ? (
              <View
                style={styles.chipRow}
                accessibilityLabel={t("profile.specialties")}
              >
                {specialtyChips.map((label) => (
                  <View key={label.toLowerCase()} style={styles.chip}>
                    <Text style={styles.chipText}>{label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {view.bio ? (
              <View>
                <Text
                  style={[styles.bio, { textAlign }]}
                  numberOfLines={canExpandBio && !bioExpanded ? 3 : undefined}
                >
                  {view.bio}
                </Text>
                {canExpandBio ? (
                  <Pressable
                    onPress={() => setBioExpanded((open) => !open)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: bioExpanded }}
                    accessibilityLabel={
                      bioExpanded ? t("profile.bioLess") : t("profile.bioMore")
                    }
                    hitSlop={8}
                    style={styles.bioToggle}
                  >
                    <Text style={styles.bioToggleText}>
                      {bioExpanded ? t("profile.bioLess") : t("profile.bioMore")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
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
              <View
                style={styles.chipRow}
                accessibilityLabel={t("profile.socialLinks")}
              >
                {socialLinks.map((link) => (
                  <Pressable
                    key={link.href}
                    style={styles.chip}
                    onPress={() => void Linking.openURL(link.href)}
                    accessibilityRole="link"
                    accessibilityLabel={link.label}
                  >
                    <Text style={styles.chipText}>{link.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {shouldShowIdentityAchievements(about.achievements) ? (
              <View
                style={styles.chipRow}
                accessibilityLabel={t("profile.achievements")}
              >
                {medals.visible.map((label) => (
                  <View key={label.toLowerCase()} style={styles.medal}>
                    <Text style={styles.medalText}>{label}</Text>
                  </View>
                ))}
                {medals.overflowCount > 0 ? (
                  <Pressable
                    style={styles.chip}
                    onPress={onOpenAbout}
                    disabled={!onOpenAbout}
                    accessibilityRole={onOpenAbout ? "button" : "text"}
                    accessibilityLabel={t("profile.tabAbout")}
                  >
                    <Text style={styles.chipText}>+{medals.overflowCount}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {showIdentityStrip ? (
              <View
                style={styles.chipRow}
                accessibilityLabel={t("profile.identityRoles")}
              >
                {roles.visible.map((label) => (
                  <View key={`role-${label.toLowerCase()}`} style={styles.chip}>
                    <Text style={styles.chipText}>{label}</Text>
                  </View>
                ))}
                {roles.overflowCount > 0 ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>+{roles.overflowCount}</Text>
                  </View>
                ) : null}
                {interests.map((label) => (
                  <View key={`interest-${label.toLowerCase()}`} style={styles.chip}>
                    <Text style={styles.chipText}>{label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: PROFILE_COVER_HEIGHT_DP,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  coverBase: {
    backgroundColor: colors.accent,
  },
  coverOrbStart: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -60,
    start: -40,
    backgroundColor: colors.accentCyan,
    opacity: 0.22,
  },
  coverOrbEnd: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -80,
    end: -50,
    backgroundColor: colors.accentIndigo,
    opacity: 0.55,
  },
  coverFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    backgroundColor: colors.bg,
    opacity: 0.35,
  },
  avatar: {
    width: PROFILE_AVATAR_SIZE_DP,
    height: PROFILE_AVATAR_SIZE_DP,
    borderRadius: PROFILE_AVATAR_SIZE_DP / 2,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 4,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -(PROFILE_AVATAR_SIZE_DP / 2),
    marginHorizontal: 20,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
  },
  identity: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  eyebrow: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  username: {
    color: colors.accentCyan,
    marginTop: 4,
    marginBottom: 10,
  },
  bio: {
    color: colors.textMuted,
    marginBottom: 4,
    lineHeight: 20,
  },
  bioToggle: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  bioToggleText: {
    color: colors.accentCyan,
    fontWeight: "700",
    fontSize: 14,
  },
  meta: {
    color: colors.textSubtle,
    fontSize: 13,
    marginBottom: 4,
  },
  link: {
    color: colors.accentCyan,
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  medal: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
    backgroundColor: "rgba(251,191,36,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  medalText: {
    color: colors.accentAmber,
    fontSize: 11,
    fontWeight: "700",
  },
});
