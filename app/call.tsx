import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCallStore } from '@/store/callStore';
import { socketService } from '@/services/socket';
import { useWebRTC, isWebRTCAvailable } from '@/hooks/useWebRTC';

// react-native-webrtc types — only used when available
let RTCView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RTCView = require('react-native-webrtc').RTCView;
} catch {
  // Expo Go
}

// ── Icons (inline SVG via Text emojis as fallback) ────────────────────────────
const Icon = ({ name, color = '#fff' }: { name: string; color?: string }) => {
  const icons: Record<string, string> = {
    mic: '🎤',
    micOff: '🔇',
    video: '📹',
    videoOff: '🚫',
    phone: '📞',
    phoneOff: '📵',
    user: '👤',
  };
  return <Text style={{ fontSize: 20, color }}>{icons[name] ?? '?'}</Text>;
};

export default function CallScreen() {
  const router = useRouter();
  const call = useCallStore();
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { localStream, remoteStreams, getLocalStream, initiateOffer, cleanup } = useWebRTC();

  const isVideo = call.callType === 'video';

  // ── Warn if WebRTC not available ────────────────────────────────────────────
  useEffect(() => {
    if (!isWebRTCAvailable) {
      Alert.alert(
        'Cần Dev Build',
        `Tính năng gọi yêu cầu cài đặt Expo Dev Build (react-native-webrtc).\n\nChạy: npx expo prebuild && npx expo run:${Platform.OS === 'ios' ? 'ios' : 'android'}`,
        [{ text: 'OK', onPress: hangUp }]
      );
      return;
    }

    getLocalStream(isVideo).catch(() => {
      if (isVideo) getLocalStream(false).catch(console.error);
    });

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start elapsed timer when connected
  useEffect(() => {
    if (call.status === 'connected') {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [call.status]);

  // Wire call:accepted to initiate WebRTC offer
  useEffect(() => {
    const onAccepted = (payload: { callId: string; userId: string }) => {
      if (payload.callId !== call.callId) return;
      call.addParticipant(payload.userId);
      initiateOffer(payload.userId);
    };
    socketService.on('call:accepted', onAccepted);
    return () => socketService.off('call:accepted', onAccepted);
  }, [call, initiateOffer]);

  const hangUp = useCallback(() => {
    if (call.callId) {
      socketService.emit('call:end', { callId: call.callId });
    }
    cleanup();
    call.endCall();
    router.back();
  }, [call, cleanup, router]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const remoteEntries = Object.entries(remoteStreams);

  const statusLabel =
    call.status === 'connected'
      ? formatTime(elapsed)
      : call.status === 'calling'
        ? 'Đang gọi…'
        : 'Đang kết nối…';

  const topPad = Platform.OS === 'ios' ? 52 : (RNStatusBar.currentHeight ?? 24) + 8;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Remote video / placeholder ────────────────────────────────── */}
      <View style={styles.remoteArea}>
        {RTCView && remoteEntries.length > 0 ? (
          <RTCView
            streamURL={remoteEntries[0][1].toURL?.()}
            style={styles.fullVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="user" color="#9ca3af" />
            <Text style={styles.waitingText}>
              {call.status === 'connected' ? 'Camera đối phương tắt' : 'Đang chờ đối phương…'}
            </Text>
          </View>
        )}
      </View>

      {/* ── Header overlay ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.statusText}>{statusLabel}</Text>
        <Text style={styles.participantCount}>{call.participantIds.length} người</Text>
      </View>

      {/* ── Local video PiP (bottom-right) ───────────────────────────── */}
      {RTCView && localStream && (
        <View style={styles.localPip}>
          <RTCView
            streamURL={localStream.toURL?.()}
            style={styles.pipVideo}
            objectFit="cover"
            mirror
          />
        </View>
      )}

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <View style={styles.controls}>
        {/* Mute */}
        <TouchableOpacity
          style={[styles.btn, call.isMuted && styles.btnActive]}
          onPress={() => call.setMuted(!call.isMuted)}
        >
          <Icon name={call.isMuted ? 'micOff' : 'mic'} />
          <Text style={styles.btnLabel}>{call.isMuted ? 'Bật mic' : 'Tắt mic'}</Text>
        </TouchableOpacity>

        {/* Camera */}
        <TouchableOpacity
          style={[styles.btn, call.isVideoOff && styles.btnActive]}
          onPress={() => call.setVideoOff(!call.isVideoOff)}
        >
          <Icon name={call.isVideoOff ? 'videoOff' : 'video'} />
          <Text style={styles.btnLabel}>{call.isVideoOff ? 'Bật cam' : 'Tắt cam'}</Text>
        </TouchableOpacity>

        {/* Hang up */}
        <TouchableOpacity style={[styles.btn, styles.hangUpBtn]} onPress={hangUp}>
          <Icon name="phoneOff" />
          <Text style={styles.btnLabel}>Kết thúc</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  remoteArea: {
    flex: 1,
    position: 'relative',
  },
  fullVideo: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  waitingText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    color: '#4ade80',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 16,
    fontWeight: '600',
  },
  participantCount: {
    color: '#9ca3af',
    fontSize: 12,
  },
  localPip: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    width: 90,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  pipVideo: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
    gap: 20,
    backgroundColor: '#1f2937',
  },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  btnActive: {
    backgroundColor: '#ef4444',
  },
  hangUpBtn: {
    backgroundColor: '#ef4444',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  btnLabel: {
    color: '#d1d5db',
    fontSize: 9,
    textAlign: 'center',
  },
});
