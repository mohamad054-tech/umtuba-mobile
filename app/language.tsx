import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isRtlLocale, useTranslation } from "@/src/lib/i18n";
import { chevronGlyph } from "@/src/lib/i18n/rtl";
import { colors } from "@/src/theme/colors";

export default function LanguageScreen() {
  const {
    t,
    locale,
    override,
    deviceLocale,
    options,
    setOverride,
    resetToDevice,
    currentDefinition,
  } = useTranslation();
  const rtl = isRtlLocale(locale);
  const deviceName = options.find((row) => row.code === deviceLocale)?.nativeName
    ?? deviceLocale;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, rtl && styles.rtlText]}>
          {t("language.subtitle")}
        </Text>
        <Text style={[styles.hint, rtl && styles.rtlText]}>
          {override
            ? t("language.usingOverride")
            : t("language.usingDevice")}
        </Text>
        <Text style={[styles.hint, rtl && styles.rtlText]}>
          {t("language.deviceLanguage", { values: { name: deviceName } })}
        </Text>

        <View style={styles.card}>
          {options.map((row, index) => {
            const selected = locale === row.code && override === row.code;
            const effective = locale === row.code;
            return (
              <View key={row.code}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  style={styles.row}
                  onPress={() => void setOverride(row.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: effective }}
                  accessibilityLabel={row.nativeName}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.label} numberOfLines={1}>
                      {row.nativeName}
                    </Text>
                    <Text style={styles.value} numberOfLines={1}>
                      {t(`languages.${row.code}`)}
                    </Text>
                  </View>
                  {effective ? (
                    <Text style={styles.check} accessible={false}>
                      {selected || !override ? "✓" : "✓"}
                    </Text>
                  ) : (
                    <Text style={styles.chevron} accessible={false}>
                      {chevronGlyph(locale)}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        <Pressable
          style={styles.reset}
          onPress={() => void resetToDevice()}
          accessibilityRole="button"
          accessibilityLabel={t("language.useDevice")}
        >
          <Text style={styles.resetText} numberOfLines={2}>
            {t("language.useDevice")}
          </Text>
        </Pressable>

        <Text style={[styles.current, rtl && styles.rtlText]} numberOfLines={2}>
          {currentDefinition.nativeName}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  subtitle: {
    color: colors.textMuted,
    marginBottom: 10,
    lineHeight: 20,
  },
  hint: {
    color: colors.textSubtle,
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  card: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  label: { color: colors.text, fontSize: 16, fontWeight: "600" },
  value: { color: colors.textSubtle, fontSize: 13 },
  chevron: { color: colors.textSubtle, fontSize: 22, lineHeight: 22 },
  check: { color: colors.accentCyan, fontSize: 18, fontWeight: "700" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 14,
  },
  reset: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  resetText: {
    color: colors.accentCyan,
    fontWeight: "700",
    textAlign: "center",
  },
  current: {
    marginTop: 16,
    color: colors.textSubtle,
    fontSize: 13,
  },
});
