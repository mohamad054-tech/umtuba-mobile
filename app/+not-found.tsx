import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t("notFound.title") }} />
      <View style={styles.container}>
        <Text style={styles.title}>{t("notFound.body")}</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{t("notFound.home")}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: colors.accentCyan,
    fontWeight: "600",
  },
});
