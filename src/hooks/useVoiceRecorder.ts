import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';

export type VoiceRecorderState = 'idle' | 'recording' | 'previewing';

export interface UseVoiceRecorderReturn {
  state: VoiceRecorderState;
  duration: number;
  recordingUri: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  clearRecording: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      clearTimer();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.warn('Microphone permission denied');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    clearTimer();
    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setDuration(finalDuration);
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setRecordingUri(uri ?? null);
      setState('previewing');
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  }, []);

  const cancelRecording = useCallback(async () => {
    clearTimer();
    await recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    setRecordingUri(null);
    setDuration(0);
    setState('idle');
  }, []);

  const clearRecording = useCallback(() => {
    setRecordingUri(null);
    setDuration(0);
    setState('idle');
  }, []);

  return {
    state,
    duration,
    recordingUri,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  };
}
