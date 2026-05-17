import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';

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

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      clearTimer();
      recorder.stop().catch(() => {});
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
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        console.warn('Microphone permission denied');
        return;
      }
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      recorder.record();
      startTimeRef.current = Date.now();
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    clearTimer();
    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setDuration(finalDuration);
    await recorder.stop();
    const uri = recorder.uri;
    setRecordingUri(uri ?? null);
    setState('previewing');
  }, [recorder]);

  const cancelRecording = useCallback(async () => {
    clearTimer();
    await recorder.stop().catch(() => {});
    setRecordingUri(null);
    setDuration(0);
    setState('idle');
  }, [recorder]);

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
