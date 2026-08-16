import { StyleSheet, TextInput, View } from "react-native";

import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type DiscoverSearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
};

export function DiscoverSearchBar({
  value,
  onChangeText,
  placeholder,
}: DiscoverSearchBarProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t("discover.searchPlaceholder")}
        placeholderTextColor={colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel={t("discover.searchA11y")}
        accessibilityHint={t("discover.searchHint")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
});
