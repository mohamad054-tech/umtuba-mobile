import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

type ProfileVideoThumbProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
};

/** First-frame preview from the signed playback URL, same source as the website grid. */
export default function ProfileVideoThumb({ uri, style }: ProfileVideoThumbProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.muted = true;
    instance.volume = 0;
    instance.loop = false;
    instance.currentTime = 0.08;
    instance.pause();
  });

  return (
    <VideoView
      player={player}
      style={[styles.thumb, style]}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#111118",
  },
});
