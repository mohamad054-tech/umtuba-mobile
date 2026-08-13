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
    buildNumber: "1",
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
      NSCameraUsageDescription:
        "UMTUBA needs camera access so you can record or join a live video session.",
      NSMicrophoneUsageDescription:
        "UMTUBA needs microphone access so you can record audio or join a live session.",
      NSPhotoLibraryUsageDescription:
        "UMTUBA needs photo library access so you can choose a video to publish.",
      NSUserNotificationsUsageDescription:
        "UMTUBA can notify you about activity on your account, such as likes, rewards, and live sessions.",
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
    versionCode: 1,
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
    permissions: [
      "CAMERA",
      "RECORD_AUDIO",
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
      "expo-camera",
      {
        cameraPermission:
          "UMTUBA needs camera access so you can record or join a live video session.",
        microphonePermission:
          "UMTUBA needs microphone access so you can record audio or join a live session.",
        recordAudioAndroid: true,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "UMTUBA needs photo library access so you can choose a video to publish.",
        cameraPermission:
          "UMTUBA needs camera access so you can record or join a live video session.",
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
