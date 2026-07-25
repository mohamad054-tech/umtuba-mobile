export type AppInfoSnapshot = {
  appName: string;
  appVersion: string;
  androidVersionCode: string | null;
  iosBuildNumber: string | null;
  runtimeVersion: string | null;
  appOwnership: string | null;
  channel: string | null;
  platform: "ios" | "android" | "web" | "unknown";
};

type ConstantsLike = {
  expoConfig?: {
    name?: string;
    version?: string;
    android?: { versionCode?: number };
    ios?: { buildNumber?: string };
    runtimeVersion?: string | { policy?: string };
  } | null;
  nativeAppVersion?: string | null;
  nativeBuildVersion?: string | null;
  appOwnership?: string | null;
  executionEnvironment?: string | null;
  platform?: { ios?: unknown; android?: unknown } | null;
  easConfig?: { projectId?: string } | null;
};

function runtimeVersionOf(
  value: string | { policy?: string } | undefined
): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && typeof value.policy === "string") {
    return value.policy;
  }
  return null;
}

/**
 * Resolve displayable app/build info. Does not include secrets or env keys.
 */
export function resolveAppInfo(
  constants: ConstantsLike,
  platformOS: string
): AppInfoSnapshot {
  const cfg = constants.expoConfig;
  const appVersion =
    (typeof constants.nativeAppVersion === "string" &&
    constants.nativeAppVersion.trim()
      ? constants.nativeAppVersion.trim()
      : null) ||
    (typeof cfg?.version === "string" && cfg.version.trim()
      ? cfg.version.trim()
      : null) ||
    "—";

  const androidCode =
    cfg?.android?.versionCode != null
      ? String(cfg.android.versionCode)
      : typeof constants.nativeBuildVersion === "string" &&
          platformOS === "android"
        ? constants.nativeBuildVersion
        : null;

  const iosBuild =
    (typeof cfg?.ios?.buildNumber === "string" && cfg.ios.buildNumber.trim()
      ? cfg.ios.buildNumber.trim()
      : null) ||
    (typeof constants.nativeBuildVersion === "string" && platformOS === "ios"
      ? constants.nativeBuildVersion
      : null);

  const platform: AppInfoSnapshot["platform"] =
    platformOS === "ios" || platformOS === "android" || platformOS === "web"
      ? platformOS
      : "unknown";

  return {
    appName:
      typeof cfg?.name === "string" && cfg.name.trim() ? cfg.name.trim() : "UMTUBA",
    appVersion,
    androidVersionCode: androidCode,
    iosBuildNumber: iosBuild,
    runtimeVersion: runtimeVersionOf(cfg?.runtimeVersion ?? undefined),
    appOwnership:
      typeof constants.appOwnership === "string" ? constants.appOwnership : null,
    channel:
      typeof constants.executionEnvironment === "string"
        ? constants.executionEnvironment
        : null,
    platform,
  };
}

export function formatBuildLabel(info: AppInfoSnapshot): string {
  if (info.platform === "android" && info.androidVersionCode) {
    return info.androidVersionCode;
  }
  if (info.platform === "ios" && info.iosBuildNumber) {
    return info.iosBuildNumber;
  }
  return info.androidVersionCode || info.iosBuildNumber || "—";
}
