import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  normalizeReferralCode,
  REFERRAL_ATTRIBUTION_TTL_SECONDS,
  REFERRAL_COOKIE_NAME,
  REFERRAL_VISITOR_COOKIE,
} from "@/src/contracts/referral";

type StoredAttribution = {
  code: string;
  savedAt: number;
};

function storageKey(name: string): string {
  return `umtuba.attr.${name}`;
}

async function readRaw(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  try {
    const secure = await SecureStore.getItemAsync(key);
    if (secure != null) return secure;
  } catch {
    // fall through
  }
  return AsyncStorage.getItem(key);
}

async function writeRaw(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

function newVisitorId(): string {
  const hex = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return hex;
}

/** Ensure a stable anonymous visitor id (first-touch companion to ref code). */
export async function getOrCreateVisitorId(): Promise<string> {
  const key = storageKey(REFERRAL_VISITOR_COOKIE);
  const existing = await readRaw(key);
  if (existing && existing.length >= 8) {
    return existing;
  }
  const id = newVisitorId();
  await writeRaw(key, id);
  return id;
}

/**
 * First-touch referral attribution (30-day TTL).
 * Later codes do not overwrite an unexpired first touch.
 */
export async function saveReferralAttribution(
  rawCode: string | null | undefined
): Promise<{ saved: boolean; code: string | null }> {
  const code = normalizeReferralCode(rawCode);
  if (!code) {
    return { saved: false, code: null };
  }

  const key = storageKey(REFERRAL_COOKIE_NAME);
  const existingRaw = await readRaw(key);

  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw) as StoredAttribution;
      const ageMs = Date.now() - (existing.savedAt || 0);
      const ttlMs = REFERRAL_ATTRIBUTION_TTL_SECONDS * 1000;
      if (
        existing.code &&
        Number.isFinite(existing.savedAt) &&
        ageMs < ttlMs
      ) {
        return { saved: false, code: existing.code };
      }
    } catch {
      // overwrite corrupt payload
    }
  }

  const payload: StoredAttribution = { code, savedAt: Date.now() };
  await writeRaw(key, JSON.stringify(payload));
  await getOrCreateVisitorId();
  return { saved: true, code };
}

export async function getReferralAttribution(): Promise<{
  code: string | null;
  visitorId: string | null;
}> {
  const key = storageKey(REFERRAL_COOKIE_NAME);
  const raw = await readRaw(key);
  let code: string | null = null;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredAttribution;
      const ageMs = Date.now() - (parsed.savedAt || 0);
      const ttlMs = REFERRAL_ATTRIBUTION_TTL_SECONDS * 1000;
      if (
        parsed.code &&
        Number.isFinite(parsed.savedAt) &&
        ageMs < ttlMs
      ) {
        code = normalizeReferralCode(parsed.code);
      }
    } catch {
      code = normalizeReferralCode(raw);
    }
  }

  const visitorId = await readRaw(storageKey(REFERRAL_VISITOR_COOKIE));
  return { code, visitorId };
}

export async function clearReferralAttribution(): Promise<void> {
  const key = storageKey(REFERRAL_COOKIE_NAME);
  if (Platform.OS !== "web") {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  }
  await AsyncStorage.removeItem(key);
}
