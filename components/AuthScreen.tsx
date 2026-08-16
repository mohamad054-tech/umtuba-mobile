import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GlobalBackButton } from "@/components/GlobalBackButton";
import { useTranslation } from "@/src/lib/i18n";
import { localeTextAlign, localeWritingDirection } from "@/src/lib/i18n/rtl";
import { colors } from "@/src/theme/colors";

type AuthScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
}: AuthScreenProps) {
  const { locale } = useTranslation();
  const textAlign = localeTextAlign(locale);
  const writingDirection = localeWritingDirection(locale);
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <View style={styles.topBar}>
          <GlobalBackButton />
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={styles.brand}>UMTUBA</Text>
          <Text style={[styles.title, { textAlign, writingDirection }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { textAlign, writingDirection }]}>
              {subtitle}
            </Text>
          ) : null}
          <View style={styles.form}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: { flex: 1 },
  topBar: {
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  form: {
    gap: 14,
  },
  footer: {
    marginTop: 28,
    alignItems: "center",
  },
});
