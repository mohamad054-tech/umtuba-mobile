import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "UMTUBA",
  slug: "umtuba-mobile",
  owner: "umtuba",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "umtuba",
  userInterfaceStyle: "dark",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.umtuba.app",
    buildNumber: "16",
    // Same Team ID already published in live AASA (M6HDH86Z55.com.umtuba.app).
    appleTeamId: "M6HDH86Z55",
    associatedDomains: [
      "applinks:umtuba.com",
      "applinks:www.umtuba.com",
    ],
    config: {
      // Standard HTTPS / OS keychain only — no custom non-exempt crypto in the app.
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      CFBundleDisplayName: "UMTUBA",
      UIStatusBarStyle: "UIStatusBarStyleLightContent",
      // IOS_ONLY store-native English usage strings (not the in-app catalog).
      NSPhotoLibraryUsageDescription:
        "UMTUBA needs photo library access so you can choose a video to publish.",
      NSUserNotificationsUsageDescription:
        "UMTUBA can notify you about likes, rewards, and account activity.",
      // ITMS-90683: MapLibre ships CLLocationManager even though World does
      // not request GPS. expo-location is unused; do not invent a nearby-users case.
      NSLocationWhenInUseUsageDescription:
        "UMTUBA includes a world map. The bundled map library references location services. UMTUBA does not use your location.",
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
      ],
    },
  },
  android: {
    package: "com.umtuba.app",
    versionCode: 17,
    adaptiveIcon: {
      backgroundColor: "#050510",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "umtuba.com", pathPrefix: "/" },
          { scheme: "https", host: "www.umtuba.com", pathPrefix: "/" },
          { scheme: "umtuba" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    // Live camera/mic are unused (Live fail-closed; Create uses gallery only).
    // Block leftovers so plugins cannot re-add them to the Play manifest.
    blockedPermissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
    ],
    permissions: [
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "POST_NOTIFICATIONS",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    [
      "expo-router",
      {
        // Used for universal-link / createURL origin alignment with associated domains.
        origin: "https://umtuba.com",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#050510",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "UMTUBA needs photo library access so you can choose a video to publish.",
        // Gallery pick uses the system photo picker — do not add camera/mic.
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission:
          "UMTUBA needs photo library access so you can choose a video to publish.",
        savePhotosPermission: false,
        granularPermissions: ["video"],
        preventAutomaticLimitedAccessAlert: true,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#050510",
        defaultChannel: "default",
      },
    ],
    "expo-secure-store",
    [
      "expo-video",
      {
        supportsBackgroundPlayback: false,
        supportsPictureInPicture: false,
      },
    ],
    "@maplibre/maplibre-react-native",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "d2593b45-8f18-4c57-9d71-0419193cfd77",
    },
  },
};

export default config;
