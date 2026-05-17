import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Pause, Play, Volume2 } from 'lucide-react-native';

interface VoiceMessageProps {
  url: string;
  duration?: number;
  isSelf?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Voice message bubble: play/pause + animated progress bar.
 */
export default function VoiceMessage({ url, duration = 0, isSelf = false }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const soundRef = useRef<Audio.Sound | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const togglePlay = useCallback(async () => {
    try {
      if (isPlaying) {
        await soundRef.current?.pauseAsync();
        setIsPlaying(false);
        return;
      }

      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            if (status.didJustFinish) {
              setIsPlaying(false);
              setCurrentTime(0);
              Animated.timing(progressAnim, { toValue: 0, duration: 0, useNativeDriver: false }).start();
              return;
            }
            const total = status.durationMillis ?? duration * 1000;
            if (total > 0) {
              const pct = (status.positionMillis ?? 0) / total;
              setCurrentTime(Math.floor((status.positionMillis ?? 0) / 1000));
              setTotalDuration(Math.round(total / 1000));
              Animated.timing(progressAnim, {
                toValue: pct,
                duration: 100,
                useNativeDriver: false,
              }).start();
            }
          }
        );
        soundRef.current = sound;
      } else {
        await soundRef.current.playAsync();
      }
      setIsPlaying(true);
    } catch (err) {
      console.error('VoiceMessage playback error:', err);
    }
  }, [isPlaying, url, duration, progressAnim]);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      className={`flex-row items-center gap-2 px-3 py-2 rounded-2xl min-w-[180px] max-w-[280px] ${
        isSelf ? 'bg-blue-500' : 'bg-gray-100'
      }`}
    >
      <TouchableOpacity
        onPress={togglePlay}
        activeOpacity={0.7}
        className={`w-8 h-8 rounded-full items-center justify-center ${
          isSelf ? 'bg-white/20' : 'bg-blue-500'
        }`}
      >
        {isPlaying ? (
          <Pause size={15} color="white" />
        ) : (
          <Play size={15} color="white" />
        )}
      </TouchableOpacity>

      <View className="flex-1 gap-1">
        <View className={`h-1.5 rounded-full overflow-hidden ${isSelf ? 'bg-white/30' : 'bg-gray-300'}`}>
          <Animated.View
            className={isSelf ? 'h-full bg-white rounded-full' : 'h-full bg-blue-500 rounded-full'}
            style={{ width: barWidth }}
          />
        </View>
        <View className="flex-row items-center gap-1">
          <Volume2 size={10} color={isSelf ? 'rgba(255,255,255,0.7)' : '#9CA3AF'} />
          <Text className={`text-xs ${isSelf ? 'text-white/70' : 'text-gray-500'}`}>
            {formatTime(isPlaying || currentTime > 0 ? currentTime : totalDuration)}
          </Text>
        </View>
      </View>
    </View>
  );
}
