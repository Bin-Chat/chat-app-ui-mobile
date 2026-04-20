import { create } from 'zustand';

export interface IncomingCallInfo {
  callId: string;
  conversationId: string;
  callType: 'audio' | 'video';
  callerId: string;
  callerName: string;
  callerAvatar?: string;
}

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected';

interface CallState {
  status: CallStatus;
  callId: string | null;
  conversationId: string | null;
  callType: 'audio' | 'video';
  participantIds: string[];
  initiatorId: string | null;
  incomingCall: IncomingCallInfo | null;
  isMuted: boolean;
  isVideoOff: boolean;

  // Actions
  setIncomingCall: (info: IncomingCallInfo) => void;
  clearIncomingCall: () => void;
  startCall: (opts: {
    callId: string;
    conversationId: string;
    callType: 'audio' | 'video';
    participantIds: string[];
    initiatorId: string;
  }) => void;
  acceptCall: (opts: {
    callId: string;
    conversationId: string;
    callType: 'audio' | 'video';
    callerId: string;
  }) => void;
  setCallConnected: () => void;
  addParticipant: (userId: string) => void;
  removeParticipant: (userId: string) => void;
  endCall: () => void;
  setMuted: (muted: boolean) => void;
  setVideoOff: (off: boolean) => void;
}

export const useCallStore = create<CallState>((set) => ({
  status: 'idle',
  callId: null,
  conversationId: null,
  callType: 'audio',
  participantIds: [],
  initiatorId: null,
  incomingCall: null,
  isMuted: false,
  isVideoOff: false,

  setIncomingCall: (info) =>
    set((s) => {
      if (s.status === 'idle' && !s.incomingCall) return { incomingCall: info };
      return {};
    }),

  clearIncomingCall: () => set({ incomingCall: null }),

  startCall: (opts) =>
    set({
      status: 'calling',
      callId: opts.callId,
      conversationId: opts.conversationId,
      callType: opts.callType,
      participantIds: opts.participantIds,
      initiatorId: opts.initiatorId,
      incomingCall: null,
      isMuted: false,
      isVideoOff: opts.callType === 'audio',
    }),

  acceptCall: (opts) =>
    set({
      status: 'ringing',
      callId: opts.callId,
      conversationId: opts.conversationId,
      callType: opts.callType,
      participantIds: [opts.callerId],
      initiatorId: opts.callerId,
      incomingCall: null,
      isMuted: false,
      isVideoOff: opts.callType === 'audio',
    }),

  setCallConnected: () => set({ status: 'connected' }),

  addParticipant: (userId) =>
    set((s) => ({
      participantIds: s.participantIds.includes(userId)
        ? s.participantIds
        : [...s.participantIds, userId],
    })),

  removeParticipant: (userId) =>
    set((s) => ({ participantIds: s.participantIds.filter((id) => id !== userId) })),

  endCall: () =>
    set({
      status: 'idle',
      callId: null,
      conversationId: null,
      callType: 'audio',
      participantIds: [],
      initiatorId: null,
      incomingCall: null,
      isMuted: false,
      isVideoOff: false,
    }),

  setMuted: (muted) => set({ isMuted: muted }),
  setVideoOff: (off) => set({ isVideoOff: off }),
}));
