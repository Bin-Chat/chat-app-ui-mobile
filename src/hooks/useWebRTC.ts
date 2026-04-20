import { useCallback, useEffect, useRef, useState } from 'react';
import { useCallStore } from '@/store/callStore';
import { socketService } from '@/services/socket';

// react-native-webrtc is NOT available in Expo Go.
// This hook gracefully degrades if the native module is missing.
// To use WebRTC on mobile, run: npx expo prebuild && npx expo run:android
let RNRTCPeerConnection: any = null;
let mediaDevices: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('react-native-webrtc');
  RNRTCPeerConnection = mod.RTCPeerConnection;
  mediaDevices = mod.mediaDevices;
} catch {
  // react-native-webrtc not installed (Expo Go)
}

export const isWebRTCAvailable = !!RNRTCPeerConnection;

const ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

interface SignalPayload {
  callId: string;
  senderId: string;
  signal: {
    type: 'offer' | 'answer' | 'ice-candidate';
    sdp?: any;
    candidate?: any;
  };
}

export function useWebRTC() {
  const { callId, setCallConnected, isMuted, isVideoOff } = useCallStore();

  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, any>>({});

  const localStreamRef = useRef<any>(null);
  const pcMap = useRef<Map<string, any>>(new Map());
  const iceCandidateBuffer = useRef<Map<string, any[]>>(new Map());
  const callIdRef = useRef<string | null>(null);
  callIdRef.current = callId;

  // Sync mute / video to track enabled state
  useEffect(() => {
    localStreamRef.current?.getAudioTracks?.().forEach((t: any) => {
      t.enabled = !isMuted;
    });
  }, [isMuted]);

  useEffect(() => {
    localStreamRef.current?.getVideoTracks?.().forEach((t: any) => {
      t.enabled = !isVideoOff;
    });
  }, [isVideoOff]);

  const createPeerConnection = useCallback(
    (remoteUserId: string): any => {
      if (!RNRTCPeerConnection) return null;

      const pc = new RNRTCPeerConnection(ICE_CONFIG);

      localStreamRef.current?.getTracks?.().forEach((track: any) => {
        pc.addTrack(track, localStreamRef.current);
      });

      pc.onicecandidate = ({ candidate }: any) => {
        if (candidate && callIdRef.current) {
          socketService.emit('call:signal', {
            callId: callIdRef.current,
            targetUserId: remoteUserId,
            signal: { type: 'ice-candidate', candidate: candidate.toJSON?.() ?? candidate },
          });
        }
      };

      pc.ontrack = (event: any) => {
        const stream = event.streams?.[0];
        if (stream) {
          setRemoteStreams((prev) => ({ ...prev, [remoteUserId]: stream }));
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          setCallConnected();
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[remoteUserId];
            return next;
          });
        }
      };

      pcMap.current.set(remoteUserId, pc);
      return pc;
    },
    [setCallConnected]
  );

  const getLocalStream = useCallback(async (video: boolean, audio = true) => {
    if (!mediaDevices) throw new Error('WebRTC not available in Expo Go');

    const stream = await mediaDevices.getUserMedia({ video, audio });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const initiateOffer = useCallback(
    async (remoteUserId: string) => {
      const pc = createPeerConnection(remoteUserId);
      if (!pc) return;

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);

      if (callIdRef.current) {
        socketService.emit('call:signal', {
          callId: callIdRef.current,
          targetUserId: remoteUserId,
          signal: { type: 'offer', sdp: pc.localDescription },
        });
      }
    },
    [createPeerConnection]
  );

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (payload.callId !== callIdRef.current) return;
      const { senderId, signal } = payload;

      let pc = pcMap.current.get(senderId);
      if (!pc) pc = createPeerConnection(senderId);
      if (!pc) return;

      if (signal.type === 'offer' && signal.sdp) {
        await pc.setRemoteDescription(signal.sdp);
        const buffered = iceCandidateBuffer.current.get(senderId) ?? [];
        for (const c of buffered) await pc.addIceCandidate(c);
        iceCandidateBuffer.current.delete(senderId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (callIdRef.current) {
          socketService.emit('call:signal', {
            callId: callIdRef.current,
            targetUserId: senderId,
            signal: { type: 'answer', sdp: pc.localDescription },
          });
        }
      } else if (signal.type === 'answer' && signal.sdp) {
        await pc.setRemoteDescription(signal.sdp);
        const buffered = iceCandidateBuffer.current.get(senderId) ?? [];
        for (const c of buffered) await pc.addIceCandidate(c);
        iceCandidateBuffer.current.delete(senderId);
      } else if (signal.type === 'ice-candidate' && signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(signal.candidate);
        } else {
          const buf = iceCandidateBuffer.current.get(senderId) ?? [];
          buf.push(signal.candidate);
          iceCandidateBuffer.current.set(senderId, buf);
        }
      }
    },
    [createPeerConnection]
  );

  const cleanup = useCallback(() => {
    pcMap.current.forEach((pc) => pc.close?.());
    pcMap.current.clear();
    iceCandidateBuffer.current.clear();
    localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop?.());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
  }, []);

  useEffect(() => {
    socketService.on('call:signal', handleSignal);
    return () => {
      socketService.off('call:signal', handleSignal);
    };
  }, [handleSignal]);

  return {
    localStream,
    remoteStreams,
    getLocalStream,
    initiateOffer,
    cleanup,
  };
}
