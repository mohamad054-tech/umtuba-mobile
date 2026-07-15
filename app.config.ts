import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "UMTUBA",
  slug: "umtuba",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "umtuba",
  userInterfaceStyle: "dark",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.umtuba.app",
    associatedDomains: [
      "applinks:umtuba.com",
      "applinks:www.umtuba.com",
    ],
    infoPlist: {
      NSCameraUsageDescription:
        "UMTUBA needs camera access so you can take photos and join video sessions.",
      NSMicrophoneUsageDescription:
        "UMTUBA needs microphone access so you can record audio and join live sessions.",
      NSPhotoLibraryUsageDescription:
        "UMTUBA needs photo library access so you can choose and share media.",
      NSPhotoLibraryAddUsageDescription:
        "UMTUBA needs permission to save media you create to your library.",
    },
  },
  android: {
    package: "com.umtuba.app",
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
    "expo-router",
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
          "UMTUBA needs camera access so you can take photos and join video sessions.",
        microphonePermission:
          "UMTUBA needs microphone access so you can record audio and join live sessions.",
        recordAudioAndroid: true,
      },
    ],
    [
      "expo-av",
      {
        microphonePermission:
          "UMTUBA needs microphone access so you can record audio and join live sessions.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "UMTUBA needs photo library access so you can choose and share media.",
        cameraPermission:
          "UMTUBA needs camera access so you can take photos and join video sessions.",
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission:
          "UMTUBA needs photo library access so you can choose and share media.",
        savePhotosPermission:
          "UMTUBA needs permission to save media you create to your library.",
        isAccessMediaLocationEnabled: true,
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
    "expo-video",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "umtuba-mobile-placeholder",
    },
  },
};

export default config;
