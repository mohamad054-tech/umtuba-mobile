import {
  useLocalSearchParams,
  useNavigation,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
import { useCallback, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, type ColorValue } from "react-native";

import { useTranslation } from "@/src/lib/i18n";
import { isRtlLocale } from "@/src/lib/i18n/locales";
import { backGlyph } from "@/src/lib/i18n/rtl";
import {
  applyGlobalBackDecision,
  globalHeaderBackSlot,
  previousRouteNameFromState,
  resolveGlobalBack,
} from "@/src/lib/nav/globalBack";
import {
  hasOtherUserProfileQuery,
  parseProfileNavOrigin,
} from "@/src/lib/profile/profileNav";
import { colors } from "@/src/theme/colors";

type GlobalBackButtonProps = {
  tintColor?: ColorValue;
  onPress?: () => void;
};

export function useGlobalBack() {
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const segments = useSegments();
  const params = useLocalSearchParams<{
    u?: string | string[];
    id?: string | string[];
    from?: string | string[];
  }>();
  const profileHasOtherUser = hasOtherUserProfileQuery(params);
  const profileOrigin = parseProfileNavOrigin(params.from);

  return useCallback(() => {
    const state = navigation.getState() as
      | { index?: number; routes?: Array<{ name?: string }> }
      | undefined;
    const decision = resolveGlobalBack({
      canGoBack: navigation.canGoBack(),
      currentPath: pathname,
      segments,
      previousRouteName: previousRouteNameFromState(state),
      profileHasOtherUser,
      profileOrigin,
    });
    applyGlobalBackDecision(decision, {
      back: () => router.back(),
      replace: (href) => router.replace(href as never),
    });
  }, [
    navigation,
    pathname,
    profileHasOtherUser,
    profileOrigin,
    router,
    segments,
  ]);
}

export function GlobalBackButton({
  tintColor = colors.text,
  onPress: onPressOverride,
}: GlobalBackButtonProps) {
  const defaultOnPress = useGlobalBack();
  const onPress = onPressOverride ?? defaultOnPress;
  const { t, locale } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel={t("actions.back")}
    >
      <Text style={[styles.arrow, { color: tintColor }]} allowFontScaling={false}>
        {backGlyph(locale)}
      </Text>
    </Pressable>
  );
}

export function useGlobalHeaderSlots(options?: {
  companion?: () => ReactNode;
}) {
  const { locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const slot = globalHeaderBackSlot(rtl);
  const back = () => <GlobalBackButton />;
  const companion = options?.companion;

  if (slot === "right") {
    return {
      headerLeft: companion ?? (() => null),
      headerRight: back,
    };
  }

  return {
    headerLeft: back,
    headerRight: companion,
  };
}

const styles = StyleSheet.create({
  hit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    direction: "ltr",
  },
  arrow: {
    fontSize: 36,
    fontWeight: "300",
    lineHeight: 40,
    marginTop: -2,
  },
});
