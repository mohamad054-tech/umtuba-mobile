import {
  useLocalSearchParams,
  useNavigation,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, type ColorValue } from "react-native";

import {
  applyGlobalBackDecision,
  previousRouteNameFromState,
  resolveGlobalBack,
} from "@/src/lib/nav/globalBack";
import { colors } from "@/src/theme/colors";

type GlobalBackButtonProps = {
  tintColor?: ColorValue;
};

function hasOtherUserParam(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim().length > 0;
}

export function useGlobalBack() {
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const segments = useSegments();
  const params = useLocalSearchParams<{ u?: string | string[] }>();
  const profileHasOtherUser = hasOtherUserParam(params.u);

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
    });
    applyGlobalBackDecision(decision, {
      back: () => router.back(),
      replace: (href) => router.replace(href as never),
    });
  }, [navigation, pathname, profileHasOtherUser, router, segments]);
}

export function GlobalBackButton({
  tintColor = colors.text,
}: GlobalBackButtonProps) {
  const onPress = useGlobalBack();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Text style={[styles.arrow, { color: tintColor }]} allowFontScaling={false}>
        ‹
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 4,
  },
  arrow: {
    fontSize: 36,
    fontWeight: "300",
    lineHeight: 40,
    marginTop: -2,
  },
});
