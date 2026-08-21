import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  PASSWORD_VISIBLE_DEFAULT,
  nextPasswordVisible,
  passwordAutofillProps,
  passwordSecureTextEntry,
  passwordVisibilityLabelKey,
  restoreSelectionAfterSecureToggle,
  shouldRestoreFocusAfterVisibilityToggle,
  type AuthPasswordPurpose,
  type TextSelectionRange,
} from "@/src/lib/auth/authInput";
import { useTranslation } from "@/src/lib/i18n";
import { localeTextAlign, localeWritingDirection } from "@/src/lib/i18n/rtl";
import { colors } from "@/src/theme/colors";

type PasswordFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  purpose: AuthPasswordPurpose;
  placeholder: string;
  accessibilityLabel: string;
  editable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

function EyeGlyph({ revealed }: { revealed: boolean }) {
  return (
    <View style={styles.glyph} pointerEvents="none">
      <View style={styles.lid} />
      <View style={styles.pupil} />
      {revealed ? null : <View style={styles.slash} />}
    </View>
  );
}

export function PasswordField({
  value,
  onChangeText,
  purpose,
  placeholder,
  accessibilityLabel,
  editable = true,
  containerStyle,
  testID,
}: PasswordFieldProps) {
  const { t, locale } = useTranslation();
  const [visible, setVisible] = useState(PASSWORD_VISIBLE_DEFAULT);
  const inputRef = useRef<TextInput>(null);
  const focusedRef = useRef(false);
  const selectionRef = useRef<TextSelectionRange | undefined>(undefined);
  const textAlign = localeTextAlign(locale);
  const writingDirection = localeWritingDirection(locale);
  const autofill = passwordAutofillProps(purpose);

  const restoreInputState = useCallback((wasFocused: boolean) => {
    if (!shouldRestoreFocusAfterVisibilityToggle(wasFocused)) {
      return;
    }
    const selection = restoreSelectionAfterSecureToggle(selectionRef.current);
    inputRef.current?.focus();
    if (selection) {
      inputRef.current?.setNativeProps({ selection });
    }
  }, []);

  const onToggleVisibility = useCallback(() => {
    const wasFocused = focusedRef.current;
    setVisible((current) => nextPasswordVisible(current));
    requestAnimationFrame(() => {
      restoreInputState(wasFocused);
    });
    setTimeout(() => {
      restoreInputState(wasFocused);
    }, 16);
  }, [restoreInputState]);

  return (
    <View
      style={[styles.field, { direction: writingDirection }, containerStyle]}
      testID={testID}
    >
      <TextInput
        ref={inputRef}
        style={[styles.input, { textAlign, writingDirection }]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={passwordSecureTextEntry(visible)}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel={accessibilityLabel}
        editable={editable}
        {...autofill}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
        }}
        onSelectionChange={(event) => {
          selectionRef.current = event.nativeEvent.selection;
        }}
      />
      <Pressable
        onPress={onToggleVisibility}
        style={styles.eye}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t(passwordVisibilityLabelKey(visible))}
        accessibilityState={{ selected: visible }}
        testID={testID ? `${testID}-visibility` : undefined}
      >
        <EyeGlyph revealed={visible} />
      </Pressable>
    </View>
  );
}

export type { PasswordFieldProps };

const EYE_SIZE = 44;

const styles = StyleSheet.create({
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  input: {
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingVertical: 14,
    paddingStart: 14,
    paddingEnd: EYE_SIZE + 8,
  },
  eye: {
    position: "absolute",
    top: 0,
    end: 0,
    minWidth: EYE_SIZE,
    minHeight: EYE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    width: 22,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  lid: {
    position: "absolute",
    width: 20,
    height: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  pupil: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textMuted,
  },
  slash: {
    position: "absolute",
    width: 22,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.textMuted,
    transform: [{ rotate: "-28deg" }],
  },
});
