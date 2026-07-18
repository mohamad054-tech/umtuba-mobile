import AsyncStorage from "@react-native-async-storage/async-storage";

const draftKey = (conversationId: string) =>
  `umtuba_msg_draft:${conversationId}`;

export async function loadDraft(conversationId: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(draftKey(conversationId))) ?? "";
  } catch {
    return "";
  }
}

export async function saveDraft(
  conversationId: string,
  text: string
): Promise<void> {
  try {
    const trimmed = text;
    if (!trimmed) {
      await AsyncStorage.removeItem(draftKey(conversationId));
      return;
    }
    await AsyncStorage.setItem(draftKey(conversationId), trimmed);
  } catch {
    // ignore
  }
}

export async function clearDraft(conversationId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(draftKey(conversationId));
  } catch {
    // ignore
  }
}
