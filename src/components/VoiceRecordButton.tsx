import { useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Mic, Trash2, Send, Square } from 'lucide-react-native';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import VoiceMessage from './VoiceMessage';
import { uploadFile } from '@/services/uploadService';
import * as FileSystem from 'expo-file-system/legacy';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface VoiceRecordButtonProps {
  /** Receive the uploaded attachment details; parent calls sendMessage */
  onSend: (attachment: {
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    duration: number;
    type: 'voice';
  }) => Promise<void>;
  disabled?: boolean;
}

/**
 * Microphone button for the mobile chat input area.
 * Tap → recording (timer + cancel/stop) → preview (play + send/cancel).
 */
export default function VoiceRecordButton({ onSend, disabled }: VoiceRecordButtonProps) {
  const {
    state,
    duration,
    recordingUri,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  } = useVoiceRecorder();
  const isSendingRef = useRef(false);

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await startRecording();
  };

  const handleSend = async () => {
    if (!recordingUri || isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      const fileInfo = await FileSystem.getInfoAsync(recordingUri);
      const size = fileInfo.exists && 'size' in fileInfo ? (fileInfo.size ?? 0) : 0;
      const mimeType = 'audio/m4a';
      const filename = `voice-${Date.now()}.m4a`;

      const attachment = await uploadFile(recordingUri, filename, mimeType, size);
      await onSend({
        url: attachment.url,
        filename,
        size: attachment.size,
        mimeType,
        duration,
        type: 'voice',
      });
      clearRecording();
    } catch (err) {
      console.error('Failed to send voice message:', err);
    } finally {
      isSendingRef.current = false;
    }
  };

  if (state === 'idle') {
    return (
      <TouchableOpacity
        onPress={handleStart}
        disabled={disabled}
        activeOpacity={0.7}
        className="p-2 rounded-full"
      >
        <Mic size={22} color="#6B7280" />
      </TouchableOpacity>
    );
  }

  if (state === 'recording') {
    return (
      <View className="flex-row items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full">
        <View className="w-2 h-2 rounded-full bg-red-500" />
        <Text className="text-sm text-red-600 font-mono min-w-[40px]">{formatTime(duration)}</Text>
        <TouchableOpacity
          onPress={cancelRecording}
          activeOpacity={0.7}
          className="p-1 rounded-full"
        >
          <Trash2 size={18} color="#EF4444" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={stopRecording}
          activeOpacity={0.7}
          className="p-1 rounded-full bg-red-500"
        >
          <Square size={16} color="white" />
        </TouchableOpacity>
      </View>
    );
  }

  // previewing
  return (
    <View className="flex-row items-center gap-2 flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2">
      {recordingUri ? (
        <View className="flex-1">
          <VoiceMessage url={recordingUri} duration={duration} />
        </View>
      ) : null}
      <TouchableOpacity
        onPress={cancelRecording}
        activeOpacity={0.7}
        className="p-1.5 rounded-full"
      >
        <Trash2 size={20} color="#6B7280" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleSend}
        activeOpacity={0.7}
        className="p-1.5 rounded-full bg-blue-500"
      >
        <Send size={18} color="white" />
      </TouchableOpacity>
    </View>
  );
}
