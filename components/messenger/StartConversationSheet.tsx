import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  I18nManager,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PersonalQrGrid } from "@/components/messenger/PersonalQrGrid";
import { commsCopy } from "@/src/lib/comms/copy";
import {
  buildPersonalContactUrl,
  isSafeContactUrlPayload,
  parsePersonalContactInput,
} from "@/src/lib/comms/contactLink";
import {
  discoverUserByEmail,
  discoverUserByPhone,
  discoverUserByUsername,
  setOwnContactSyncPermission,
} from "@/src/lib/comms/discovery";
import { normalizeDiscoveryEmail } from "@/src/lib/comms/emailIdentity";
import { normalizeE164Input } from "@/src/lib/comms/phoneIdentity";
import type { DiscoveredIdentity } from "@/src/lib/comms/privacyContract";
import { getOrCreateDirectConversation } from "@/src/lib/messenger/api";
import { conversationThreadHref } from "@/src/lib/messenger/mapDestination";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

type StartTab = "username" | "email" | "phone" | "link";

type StartConversationSheetProps = {
  visible: boolean;
  currentUserId: string;
  ownUsername: string | null;
  initialQuery?: string;
  onClose: () => void;
  onOpenConversation: (href: string) => void;
};

export function StartConversationSheet({
  visible,
  currentUserId,
  ownUsername,
  initialQuery = "",
  onClose,
  onOpenConversation,
}: StartConversationSheetProps) {
  const copy = commsCopy(I18nManager.isRTL);
  const [tab, setTab] = useState<StartTab>("username");
  const [query, setQuery] = useState(initialQuery);
  const [looking, setLooking] = useState(false);
  const [opening, setOpening] = useState(false);
  const [identity, setIdentity] = useState<DiscoveredIdentity | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactNote, setContactNote] = useState<string | null>(null);

  useEffect(() => {
    if (visible && initialQuery) {
      setQuery(initialQuery);
      setTab("username");
    }
  }, [visible, initialQuery]);

  const ownLink = useMemo(
    () => (ownUsername ? buildPersonalContactUrl(ownUsername) : null),
    [ownUsername]
  );

  const tabs: { id: StartTab; label: string }[] = [
    { id: "username", label: copy.tabUsername },
    { id: "email", label: copy.tabEmail },
    { id: "phone", label: copy.tabPhone },
    { id: "link", label: copy.tabLink },
  ];

  const placeholder =
    tab === "username"
      ? copy.usernamePlaceholder
      : tab === "email"
        ? copy.emailPlaceholder
        : tab === "phone"
          ? copy.phonePlaceholder
          : copy.linkPlaceholder;

  async function lookup() {
    setLooking(true);
    setError(null);
    setNotFound(false);
    setIdentity(null);

    const supabase = getSupabase();
    let result: Awaited<ReturnType<typeof discoverUserByUsername>>;

    if (tab === "username") {
      result = await discoverUserByUsername(supabase, query);
    } else if (tab === "email") {
      const email = normalizeDiscoveryEmail(query);
      result = email
        ? await discoverUserByEmail(supabase, email)
        : { ok: true, identity: null };
    } else if (tab === "phone") {
      const e164 = normalizeE164Input(query);
      result = e164
        ? await discoverUserByPhone(supabase, e164)
        : { ok: true, identity: null };
    } else {
      const parsed = parsePersonalContactInput(query);
      result = parsed
        ? await discoverUserByUsername(supabase, parsed.username)
        : { ok: true, identity: null };
    }

    setLooking(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (!result.identity) {
      setNotFound(true);
      return;
    }
    setIdentity(result.identity);
  }

  async function openConversation(target: DiscoveredIdentity) {
    if (target.userId === currentUserId) {
      setError(copy.notFound);
      return;
    }
    setOpening(true);
    setError(null);
    const result = await getOrCreateDirectConversation(
      getSupabase(),
      target.userId
    );
    setOpening(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const href = conversationThreadHref(result.conversationId);
    if (!href) {
      setError(copy.notFound);
      return;
    }
    onClose();
    onOpenConversation(href);
  }

  async function rememberContactPermission(granted: boolean) {
    setContactNote(null);
    const result = await setOwnContactSyncPermission(getSupabase(), granted);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setContactNote(granted ? copy.contactsSaved : copy.contactsRevoked);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>{copy.startConversation}</Text>
                <Text style={styles.title} accessibilityRole="header">
                  {copy.startTitle}
                </Text>
                <Text style={styles.intro}>{copy.startIntro}</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={copy.closeStart}
                style={styles.close}
              >
                <Text style={styles.closeText}>{copy.closeStart}</Text>
              </Pressable>
            </View>

            <View style={styles.tabs}>
              {tabs.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setTab(item.id);
                    setIdentity(null);
                    setNotFound(false);
                    setError(null);
                  }}
                  style={[styles.tab, tab === item.id && styles.tabOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tab === item.id }}
                  accessibilityLabel={item.label}
                >
                  <Text
                    style={[styles.tabText, tab === item.id && styles.tabTextOn]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setNotFound(false);
                setIdentity(null);
                setError(null);
              }}
              placeholder={placeholder}
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={
                tab === "email"
                  ? "email-address"
                  : tab === "phone"
                    ? "phone-pad"
                    : "default"
              }
              style={styles.input}
              textAlign="left"
              accessibilityLabel={placeholder}
            />
            <Pressable
              style={styles.find}
              onPress={() => void lookup()}
              disabled={looking || !query.trim()}
              accessibilityRole="button"
              accessibilityLabel={copy.lookup}
              accessibilityState={{ disabled: looking || !query.trim() }}
            >
              {looking ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.findText}>{copy.lookup}</Text>
              )}
            </Pressable>

            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            {identity ? (
              <View style={styles.card}>
                <View style={styles.foundRow}>
                  {identity.avatarUrl ? (
                    <Image
                      source={{ uri: identity.avatarUrl }}
                      style={styles.avatar}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {identity.displayName.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.foundMeta}>
                    <Text style={styles.foundName}>{identity.displayName}</Text>
                    <Text style={styles.foundUser}>@{identity.username}</Text>
                    <Text style={styles.foundHint}>{copy.identityFound}</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.message}
                  onPress={() => void openConversation(identity)}
                  disabled={opening}
                  accessibilityRole="button"
                  accessibilityLabel={copy.message}
                >
                  {opening ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Text style={styles.messageText}>{copy.message}</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {notFound ? (
              <View style={styles.card}>
                <Text style={styles.foundHint}>{copy.notFound}</Text>
                <Text style={styles.boundary}>{copy.inviteBoundary}</Text>
              </View>
            ) : null}

            {tab === "link" ? (
              <View style={styles.card}>
                {ownLink && isSafeContactUrlPayload(ownLink) ? (
                  <>
                    <Text style={styles.eyebrow}>{copy.yourLink}</Text>
                    <Text style={styles.link} selectable>
                      {ownLink}
                    </Text>
                    <Text style={[styles.eyebrow, styles.qrLabel]}>
                      {copy.yourQr}
                    </Text>
                    <PersonalQrGrid url={ownLink} />
                    <Text style={styles.boundary}>{copy.scanHint}</Text>
                  </>
                ) : null}
                <Text style={styles.boundary}>{copy.contactsFoundation}</Text>
                <Pressable
                  style={styles.secondary}
                  onPress={() => void rememberContactPermission(true)}
                  accessibilityRole="button"
                  accessibilityLabel={copy.contactsAllow}
                >
                  <Text style={styles.secondaryText}>{copy.contactsAllow}</Text>
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  onPress={() => void rememberContactPermission(false)}
                  accessibilityRole="button"
                  accessibilityLabel={copy.contactsRevoke}
                >
                  <Text style={styles.secondaryText}>{copy.contactsRevoke}</Text>
                </Pressable>
                {contactNote ? (
                  <Text style={styles.foundHint}>{contactNote}</Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 12,
  },
  scroll: {
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: { flex: 1, gap: 4 },
  eyebrow: {
    color: colors.accentCyan,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  close: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  tabOn: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  tabTextOn: { color: colors.bg },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 14,
  },
  find: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  findText: { color: colors.bg, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 14 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: 14,
    gap: 10,
  },
  foundRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: { color: colors.text, fontWeight: "800", fontSize: 18 },
  foundMeta: { flex: 1, gap: 2 },
  foundName: { color: colors.text, fontWeight: "800", fontSize: 16 },
  foundUser: { color: colors.accentCyan },
  foundHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  message: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.accentCyan,
    alignItems: "center",
    justifyContent: "center",
  },
  messageText: { color: colors.bg, fontWeight: "800" },
  boundary: { color: colors.textSubtle, fontSize: 12, lineHeight: 18 },
  link: { color: colors.accentCyan, fontSize: 14 },
  qrLabel: { marginTop: 4 },
  secondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  secondaryText: {
    color: colors.accentCyan,
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
});
