import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "umtuba.push.expoToken";
const USER_KEY = "umtuba.push.userId";

async function read(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  try {
    return (await SecureStore.getItemAsync(key)) ?? (await AsyncStorage.getItem(key));
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function write(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(key);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function remove(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
  await AsyncStorage.removeItem(key);
}

export async function getCachedPushToken(): Promise<string | null> {
  return read(TOKEN_KEY);
}

export async function getCachedPushUserId(): Promise<string | null> {
  return read(USER_KEY);
}

export async function cachePushRegistration(
  userId: string,
  token: string
): Promise<void> {
  await write(USER_KEY, userId);
  await write(TOKEN_KEY, token);
}

export async function clearCachedPushRegistration(): Promise<void> {
  await remove(TOKEN_KEY);
  await remove(USER_KEY);
}
