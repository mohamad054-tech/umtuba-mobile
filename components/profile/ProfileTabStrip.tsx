import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { ProfileTranslate } from "@/components/profile/profileUi";
import type { AppLocale } from "@/src/lib/i18n/locales";
import { localeWritingDirection } from "@/src/lib/i18n/rtl";
import type { MobileProfileTabId } from "@/src/lib/profile/profileTabs";
import { colors } from "@/src/theme/colors";

type ProfileTabStripProps = {
  locale: AppLocale;
  t: ProfileTranslate;
  tabs: readonly MobileProfileTabId[];
  active: MobileProfileTabId;
  onChange: (tab: MobileProfileTabId) => void;
};

function tabLabel(id: MobileProfileTabId, t: ProfileTranslate): string {
  switch (id) {
    case "all":
      return t("profile.tabAll");
    case "posts":
      return t("profile.posts");
    case "videos":
      return t("profile.videos");
    case "about":
      return t("profile.tabAbout");
  }
}

export default function ProfileTabStrip({
  locale,
  t,
  tabs,
  active,
  onChange,
}: ProfileTabStripProps) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t("profile.tablistA11y")}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.row,
          { direction: localeWritingDirection(locale) },
        ]}
      >
        {tabs.map((id) => {
          const selected = id === active;
          return (
            <Pressable
              key={id}
              onPress={() => onChange(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tabLabel(id, t)}
              style={[styles.tab, selected && styles.tabOn]}
            >
              <Text style={[styles.tabText, selected && styles.tabTextOn]}>
                {tabLabel(id, t)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 13,
  },
  tabTextOn: {
    color: colors.bg,
  },
});
