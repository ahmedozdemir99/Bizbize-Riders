import React, { useState, useEffect, useRef } from 'react';
import { 
  UserProfile, 
  CortegeGroup, 
  DirectContact, 
  Message, 
  MessageType, 
  CallRecord, 
  GroupCallRecord 
} from './types';
import { 
  getSupabaseClient, 
  getDeviceId, 
  getUsername, 
  setUsername, 
  initSupabase 
} from './services/supabase';
import { isMessageForRider } from './services/messageAccess';
import { notifyIncomingCall, dismissCallNotification, enableNotifications, type NotificationIntent } from './services/notifications';
import { parseBackup } from './services/backup';
import { GroupCall } from './services/groupCall';
import { CallConnection, resolveRiderId } from './services/callConnection';
import { soundEffects } from './services/sound';
import { 
  mergeMessages,
  unpersistedChats,
  getAllLocalMessages,
  getLocalMessages, 
  saveLocalMessage, 
  updateLocalMessages,
  clearLocalMessages, 
  subscribeLocalBroadcast,
  broadcastLocalEvent 
} from './services/localStore';

import { Header } from './components/Header';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';
import { LoginScreen } from './components/LoginScreen';
import { AttachMenuDrawer } from './components/AttachMenuDrawer';
import { MediaViewer } from './components/MediaViewer';
import { CallScreenModal } from './components/CallScreenModal';
import { SqlSetupModal } from './components/SqlSetupModal';

import { NewGroupModal } from './components/Modals/NewGroupModal';
import { RidersDirectoryModal } from './components/Modals/RidersDirectoryModal';
import { CallHistoryModal } from './components/Modals/CallHistoryModal';
import { BackupModal } from './components/Modals/BackupModal';
import { IncomingCallModal } from './components/Modals/IncomingCallModal';
import { IncomingGroupCallModal } from './components/Modals/IncomingGroupCallModal';
import { AddRiderModal } from './components/Modals/AddRiderModal';
import { ProfileSettingsModal } from './components/Modals/ProfileSettingsModal';
import { GroupMapModal } from './components/Modals/GroupMapModal';
import { RoadAlertModal } from './components/Modals/RoadAlertModal';
import { VoiceAssistantModal } from './components/Modals/VoiceAssistantModal';

const DEFAULT_GROUPS: Record<string, { info: CortegeGroup }> = {
  global: {
    info: {
      id: 'global',
      name: 'Ortak Kortej 🏍️',
      avatar: '🏍️',
      color: 'from-neutral-700 to-neutral-900',
    },
  },
};

export default function App() {
  const deviceId = getDeviceId();
  const [currentUser, setCurrentUser] = useState<string>(getUsername());
  const [statusText, setStatusText] = useState<string>('Bağlantı denetleniyor');
  const [isOnlineOk, setIsOnlineOk] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Active view & selection
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatName, setActiveChatName] = useState<string>('');
  const [activeChatAvatar, setActiveChatAvatar] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deletedGroupIds, setDeletedGroupIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('rider_deleted_group_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [deletedMsgIds, setDeletedMsgIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('rider_deleted_msg_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [groups, setGroups] = useState<Record<string, { info: CortegeGroup }>>(() => {
    try {
      const saved = localStorage.getItem('rider_custom_groups');
      const loaded: Record<string, { info: CortegeGroup }> = saved ? { ...DEFAULT_GROUPS, ...JSON.parse(saved) } : DEFAULT_GROUPS;
      const deleted = new Set<string>(JSON.parse(localStorage.getItem('rider_deleted_group_ids') || '[]'));
      const filtered: Record<string, { info: CortegeGroup }> = {};
      Object.entries(loaded).forEach(([id, g]) => {
        if (!deleted.has(id)) {
          filtered[id] = g;
        }
      });
      return filtered;
    } catch {
      return DEFAULT_GROUPS;
    }
  });

  const [dmContacts, setDmContacts] = useState<Record<string, DirectContact>>(() => {
    try {
      const saved = localStorage.getItem('rider_dm_contacts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [hiddenRiderIds, setHiddenRiderIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('rider_hidden_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [onlineRiders, setOnlineRiders] = useState<UserProfile[]>([]);
  const [allRiders, setAllRiders] = useState<UserProfile[]>([]);
  const groupsRef = useRef(groups); groupsRef.current = groups;
  const hiddenRidersRef = useRef(hiddenRiderIds); hiddenRidersRef.current = hiddenRiderIds;
  const [messages, setMessages] = useState<Message[]>([]);

  // Modals state
  const [isAttachOpen, setIsAttachOpen] = useState<boolean>(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState<boolean>(false);
  const [isRidersOpen, setIsRidersOpen] = useState<boolean>(false);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState<boolean>(false);
  const [isBackupOpen, setIsBackupOpen] = useState<boolean>(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [isAddRiderOpen, setIsAddRiderOpen] = useState<boolean>(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState<boolean>(false);
  const [isGroupMapOpen, setIsGroupMapOpen] = useState<boolean>(false);
  const [isRoadAlertOpen, setIsRoadAlertOpen] = useState<boolean>(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState<boolean>(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(() => localStorage.getItem('rider_avatar'));

  // Lightbox Media Viewer
  const [mediaViewerState, setMediaViewerState] = useState<{
    url: string | null;
    type: 'image' | 'video' | null;
    filename?: string | null;
  }>({ url: null, type: null });

  // Calls history & incoming calls
  const [callHistory, setCallHistory] = useState<CallRecord[]>(() => {
    try {
      const saved = localStorage.getItem('rider_call_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [pendingCall, setPendingCall] = useState<CallRecord | null>(null);
  const [isLiveLocationTracking, setIsLiveLocationTracking] = useState<boolean>(false);
  const locationGenerationRef = useRef(0);
  const liveLocationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('rider_call_history', JSON.stringify(callHistory));
  }, [callHistory]);
  const [pendingGroupCall, setPendingGroupCall] = useState<GroupCallRecord | null>(null);

  // Active WebRTC Call State
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [callTitle, setCallTitle] = useState<string>('');
  const [callStatusText, setCallStatusText] = useState<string>('Bağlanıyor...');
  const [isCallModalOpen, setIsCallModalOpen] = useState<boolean>(false);
  const [isGroupCall, setIsGroupCall] = useState<boolean>(false);

  // WebRTC Media Streams & Connections
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [groupRemoteStreams, setGroupRemoteStreams] = useState<
    Record<string, { name: string; stream: MediaStream }>
  >({});

  const groupCallRef = useRef<GroupCall | null>(null);
  const preparingCallRef = useRef(false);
  const callGenerationRef = useRef(0);
  const pendingCallRef = useRef(pendingCall); pendingCallRef.current = pendingCall;
  const [callConnectedAt, setCallConnectedAt] = useState<number | null>(null);
  const dismissedGroupCallsRef = useRef(new Set<string>());
  const callSessionRef = useRef<{ id: string; peer: string; connection: CallConnection; stream: MediaStream; startedAt: number; initiator: boolean; answeredAt?: number; connectedAt?: number; restarts: number; disconnectedAt?: number; signals: Set<string> } | null>(null);
  const activeChatRef = useRef(activeChatId);
  activeChatRef.current = activeChatId;
  const messageLoadRef = useRef(0);

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (msg: string, ms = 3400) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (ms > 0) {
      toastTimerRef.current = window.setTimeout(() => setToastMsg(null), ms);
    }
  };

  // A tracking callback belongs to one chat and one signed-in session.
  useEffect(() => {
    setIsLiveLocationTracking(false);
    return () => {
      locationGenerationRef.current++;
      if (liveLocationTimerRef.current !== null) {
        clearInterval(liveLocationTimerRef.current);
        liveLocationTimerRef.current = null;
      }
    };
  }, [activeChatId, currentUser]);

  // 1. Initial Supabase Setup & Heartbeat with Offline Resilience
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setStatusText('Bağlantı ayarı gerekli');
      setIsOnlineOk(false);
      return;
    }

    if (currentUser) {
      registerPresence(currentUser);
      syncGroupsFromServer();
      fetchOnlineRiders();


    }

    const interval = setInterval(() => {
      if (currentUser) { registerPresence(currentUser); fetchOnlineRiders(); void syncGroupsFromServer(); }
    }, 25000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Subscribe to local BroadcastChannel for tab-to-tab sync
  useEffect(() => {
    const unsubscribe = subscribeLocalBroadcast((data) => {
      if (data.type === 'NEW_LOCAL_MESSAGE' && data.payload) {
        const m: Message = data.payload;
        if (!isMessageForRider(m, deviceId)) return;
        if (activeChatId && m.group_id === activeChatId) {
          loadMessages(activeChatId);
        } else if (m.sender_id !== deviceId) {
          if (soundEnabled) soundEffects.messageChime();
          showToast(`${m.sender_name || 'Rider'}: ${m.text || 'Yeni mesaj'}`);
        }
      } else if (data.type === 'DELETE_LOCAL_GROUP' && data.payload?.id) {
        const next = { ...groupsRef.current }; delete next[data.payload.id]; groupsRef.current = next; setGroups(next);
        if (activeChatRef.current === data.payload.id) { activeChatRef.current = null; setActiveChatId(null); }
      } else if (data.type === 'NEW_LOCAL_GROUP' && data.payload) {
        setGroups((prev) => ({
          ...prev,
          [data.payload.id]: { info: data.payload },
        }));
      }
    });
    return unsubscribe;
  }, [activeChatId, deviceId, soundEnabled]);

  // Save groups and DM contacts to LocalStorage
  useEffect(() => {
    localStorage.setItem('rider_custom_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('rider_dm_contacts', JSON.stringify(dmContacts));
  }, [dmContacts]);

  useEffect(() => {
    localStorage.setItem('rider_hidden_ids', JSON.stringify([...hiddenRiderIds]));
  }, [hiddenRiderIds]);

  useEffect(() => {
    localStorage.setItem('rider_deleted_group_ids', JSON.stringify([...deletedGroupIds]));
  }, [deletedGroupIds]);

  useEffect(() => {
    localStorage.setItem('rider_deleted_msg_ids', JSON.stringify([...deletedMsgIds]));
  }, [deletedMsgIds]);

  const registerPresence = async (name: string) => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { error } = await client.from('profiles').upsert({
        id: deviceId,
        name,
        online: true,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        setStatusText('Yerel Mod (Sunucu Çevrimdışı)');
        setIsOnlineOk(false);
      } else {
        setStatusText('Supabase bağlantısı hazır');
        setIsOnlineOk(true);
      }
    } catch (err) {
      setStatusText('Yerel Mod (Sunucu Çevrimdışı)');
      setIsOnlineOk(false);
    }
  };

  const syncGroupsFromServer = async () => {
    const client = getSupabaseClient(); if (!client) return;
    try {
      const pending: string[] = JSON.parse(localStorage.getItem('rider_pending_groups') || '[]');
      for (const id of pending) {
        const group = groupsRef.current[id]?.info;
        if (!group || group.created_by !== deviceId) continue;
        const { error } = await client.from('rider_groups').upsert(group);
        if (!groupsRef.current[id]) { await client.from('rider_groups').delete().eq('id',id).eq('created_by',deviceId); continue; }
        if (!error) {
          const remaining: string[] = JSON.parse(localStorage.getItem('rider_pending_groups') || '[]');
          localStorage.setItem('rider_pending_groups', JSON.stringify(remaining.filter(key => key !== id)));
        }
      }
      const { data, error } = await client.from('rider_groups').select('*').order('created_at', { ascending: true }).limit(300);
      if (error || !data) return;
      const deleted = new Set(JSON.parse(localStorage.getItem('rider_deleted_group_ids') || '[]'));
      const known = new Set(JSON.parse(localStorage.getItem('rider_synced_group_ids') || '[]'));
      const pendingNow = new Set(JSON.parse(localStorage.getItem('rider_pending_groups') || '[]'));
      const next = { ...DEFAULT_GROUPS };
      for (const [id, group] of Object.entries(groupsRef.current)) {
        if ((!known.has(id) || pendingNow.has(id)) && !deleted.has(id)) next[id] = group;
      }
      for (const group of data) if (!deleted.has(group.id)) next[group.id] = { info: group };
      localStorage.setItem('rider_synced_group_ids', JSON.stringify(data.map(group => group.id)));
      groupsRef.current = next; setGroups(next);
    } catch (error) { console.warn('Group sync:', error); }
  };

  const fetchOnlineRiders = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .neq('id', deviceId)
        .order('name');

      if (!error && data) {
        const filtered = data.filter(
          (u) =>
            !hiddenRidersRef.current.has(String(u.id)) &&
            u.online &&
            u.updated_at &&
            Date.now() - new Date(u.updated_at).getTime() < 70000
        );
        setOnlineRiders(filtered);
        setAllRiders(data.filter((u) => !hiddenRidersRef.current.has(String(u.id))));
      }
    } catch (e) {
      console.warn('Fetch online riders offline fallback');
    }
  };

  // Realtime Subscriptions
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !currentUser) return;

    try {
      // Messages channel
      const msgChannel = client
        .channel(`app-messages-${deviceId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload: any) => {
            const m: Message = payload.new;
            if (!isMessageForRider(m, deviceId)) return;
            if (activeChatId && m.group_id === activeChatId) {
              loadMessages(activeChatId);
            } else if (m.sender_id !== deviceId) {
              if (soundEnabled) soundEffects.messageChime();
              showToast(`${m.sender_name || 'Bir sürücü'}: ${m.text || 'Yeni bir ek gönderildi'}`);
            }
          }
        )
        .subscribe();

      // Calls channel (Full WebRTC signaling: 1-on-1 calls, group calls, ICE candidates, and answers)
      const callChannel = client
        .channel(`app-calls-${deviceId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'calls' },
          async (payload: any) => {
            const c: CallRecord = payload.new;
            if (!c) return;
            if (['ended','rejected','missed'].includes(c.status)) { setPendingCall(prev => prev?.id === c.id ? null : prev); void dismissCallNotification(c.id); }
            if (c.callee_id === deviceId && c.status === 'ringing' &&
              (preparingCallRef.current || callSessionRef.current || groupCallRef.current) && callSessionRef.current?.id !== c.id) {
              await client.from('calls').update({status:'rejected'}).eq('id',c.id).eq('status','ringing'); return;
            }

            // Incoming call for this device
            if (c.callee_id === deviceId && c.status === 'ringing' && !preparingCallRef.current && !callSessionRef.current && !groupCallRef.current) {
              setPendingCall(c);
              if (soundEnabled) soundEffects.ringTone();
              void notifyIncomingCall(c);
            }

            const session = callSessionRef.current;
            if (session && c.id === session.id) {
              if (c.status === 'connected' && c.answer) {
                session.answeredAt ||= Date.now();
                await session.connection.receive('answer', c.answer);
              } else if (['rejected','ended','missed'].includes(c.status)) {
                finishCall(c.status === 'rejected' ? 'rejected' : c.status === 'missed' ? 'missed' : 'ended', false);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'call_signals' },
          async (payload: any) => {
            const sig = payload.new;
            const session = callSessionRef.current;
            if (!session || !sig || sig.to_id !== deviceId || sig.from_id !== session.peer || sig.call_id !== session.id) return;
            try { await receiveCallSignal(session,sig); }
            catch (error) { console.warn('Call signaling:', error); }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'group_calls' },
          (payload: any) => {
            const gcall: GroupCallRecord = payload.new;
            const callerId = gcall?.caller_id || gcall?.host_id;
            if (!preparingCallRef.current && !callSessionRef.current && !groupCallRef.current && gcall && callerId !== deviceId && (gcall.status === 'active' || gcall.status === 'ringing')) {
              setPendingGroupCall(gcall);
              if (soundEnabled) soundEffects.ringTone();
            }
          }
        )
        .subscribe();

      // Mobile background sleep resilient polling heartbeat (checks every 2.5s)
      const callPollingInterval = window.setInterval(async () => {
        try {
          const cutoff = new Date(Date.now() - 45000).toISOString();

          // 1. Check for incoming 1-on-1 ringing call
          const { data: incoming, error: incomingError } = await client
            .from('calls')
            .select('*')
            .eq('callee_id', deviceId)
            .eq('status', 'ringing')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!preparingCallRef.current && !callSessionRef.current && !groupCallRef.current && incoming && incoming.length > 0) {
            const inc = incoming[0];
            void notifyIncomingCall(inc);
            setPendingCall((prev) => {
              if (!prev || prev.id !== inc.id) {
                if (soundEnabled) soundEffects.ringTone();
                return inc;
              }
              return prev;
            });
          }

          if (!incomingError && !preparingCallRef.current && !callSessionRef.current && !incoming?.length) setPendingCall(null);
          if (incoming?.[0] && (callSessionRef.current || groupCallRef.current) && incoming[0].id !== callSessionRef.current?.id) {
            await client.from('calls').update({status:'rejected'}).eq('id',incoming[0].id).eq('status','ringing');
          }

          // 2. Check for incoming group call
          const { data: gcalls } = await client
            .from('group_calls')
            .select('*')
            .neq('host_id', deviceId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(10);

          if (!preparingCallRef.current && !callSessionRef.current && !groupCallRef.current && gcalls && gcalls.length > 0) {
            const gc = gcalls.find(call => !dismissedGroupCallsRef.current.has(call.id));
            if (!gc) { setPendingGroupCall(null); return; }
            setPendingGroupCall((prev) => {
              if (!prev || prev.id !== gc.id) {
                if (soundEnabled) soundEffects.ringTone();
                return gc;
              }
              return prev;
            });
          }

          // Replay persisted signaling as well as realtime events: candidates can arrive
          // while the receiver is granting microphone permission or changing channels.
          const session = callSessionRef.current;
          if (session) {
            const { data: stateData } = await client.from('calls').select('*').eq('id', session.id).limit(1);
            if (callSessionRef.current !== session) return;
            const state = stateData?.[0];
            if (state && ['ended','rejected','missed'].includes(state.status)) { finishCall(state.status === 'rejected' ? 'rejected' : state.status === 'missed' ? 'missed' : 'ended', false); return; }
            if (state?.answer) { session.answeredAt ||= Date.now(); await session.connection.receive('answer', state.answer); }
            const { data: signals } = await client.from('call_signals').select('*')
              .eq('call_id', session.id).eq('to_id', deviceId).eq('from_id', session.peer).order('id');
            if (callSessionRef.current !== session) return;
            for (const signal of signals || []) await receiveCallSignal(session,signal);
          }
        } catch {}
      }, 2500);

      return () => {
        client.removeChannel(msgChannel);
        client.removeChannel(callChannel);
        clearInterval(callPollingInterval);
      };
    } catch {
      console.warn('Realtime subscription offline fallback');
    }
  }, [currentUser, activeChatId, deviceId, soundEnabled, activeCallId, isCallModalOpen]);

  // Publish local messages immediately; merge server responses with the current cache,
  // never a snapshot taken before a newer send or a chat switch.
  const loadMessages = async (groupId: string) => {
    const request = ++messageLoadRef.current;
    const valid = (m: Message) => {
      const clearedAt = Number(localStorage.getItem(`rider_cleared_at_${groupId}`) || 0);
      let deleted: string[] = [];
      try { deleted = JSON.parse(localStorage.getItem('rider_deleted_msg_ids') || '[]'); } catch {}
      return (!clearedAt || m.time > clearedAt) && !m.deleted &&
        !deleted.includes(String(m.id)) && !deleted.includes(`${m.sender_id}_${m.time}`);
    };
    if (activeChatRef.current === groupId) setMessages(getLocalMessages(groupId).filter(valid));
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { data, error } = await client.from('messages').select('*')
        .eq('group_id', groupId).order('time', { ascending: false }).limit(500);
      if (error || request !== messageLoadRef.current || activeChatRef.current !== groupId) return;
      const merged = mergeMessages(getLocalMessages(groupId), data || []).filter(valid);
      updateLocalMessages(groupId, merged);
      setMessages(merged);
    } catch { /* The optimistic local view remains visible. */ }
  };

  useEffect(() => {
    if (!activeChatId || !currentUser) return;
    void loadMessages(activeChatId);
    const timer = window.setInterval(() => void loadMessages(activeChatId), 4000);
    return () => clearInterval(timer);
  }, [activeChatId, currentUser]);

  const handleLogin = (name: string) => {
    setUsername(name);
    setCurrentUser(name);
    if (soundEnabled) soundEffects.revEngine();
    showToast(`Hoş geldin, ${name}! Kontağı çevirdin.`);
    registerPresence(name);
  };

  const handleLogout = async () => {
    if (!window.confirm('Çıkış yapmak istediğinize emin misiniz?')) return;
    const name = currentUser;
    handleEndCall(); setIsAttachOpen(false); setPendingCall(null); setPendingGroupCall(null);
    activeChatRef.current = null;
    localStorage.removeItem('rider_username'); setCurrentUser(''); setActiveChatId(null);
    const client = getSupabaseClient();
    if (client) {
      try { await client.from('profiles').upsert({ id: deviceId, name, online: false, updated_at: new Date().toISOString() }); }
      catch { /* Local logout and media cleanup already completed. */ }
    }
  };

  const handleOpenChat = (id: string, name: string, avatar: string) => {
    if (id.startsWith('dm_')) {
      const rider = allRiders.find((r) => 'dm_' + [deviceId, r.id].sort().join('_') === id);
      if (rider) {
        setDmContacts((prev) => ({ ...prev, [id]: { id: rider.id, name, avatar } }));
      }
    }
    activeChatRef.current = id;
    setActiveChatId(id);
    setActiveChatName(name);
    setActiveChatAvatar(avatar);
    loadMessages(id);
  };

  const handleSendMessage = async (
    type: MessageType, 
    content: string, 
    filename?: string, 
    replyToId?: string,
    replyPreview?: { sender_name: string; text?: string | null }
  ) => {
    if (!activeChatId || !currentUser || activeChatRef.current !== activeChatId) return;

    const directRecipient = activeChatId.startsWith('dm_') ? resolveRiderId(activeChatId, deviceId, dmContacts[activeChatId]?.id) : null;

    const row: Message = {
      group_id: activeChatId,
      sender_id: deviceId,
      recipient_id: directRecipient || null,
      sender_name: currentUser,
      type,
      text: type === 'text' ? content : null,
      url: ['image', 'video', 'audio', 'file', 'location'].includes(type) ? content : null,
      filename: filename || null,
      time: Date.now(),
      deleted: false,
      reply_to_id: replyToId,
      reply_preview: replyPreview,
    };

    // Always persist to local store first
    const updated = saveLocalMessage(activeChatId, row);
    setMessages(updated);
    if (unpersistedChats.has(activeChatId)) showToast('Cihaz hafızası dolu. Mesaj bu oturumda tutuluyor; sunucuya gönderiliyor.');
    if (soundEnabled) soundEffects.click();

    // Try background insert to Supabase if connected
    const client = getSupabaseClient();
    if (client) {
      try {
        const payload: Record<string, any> = {
          group_id: row.group_id,
          sender_id: row.sender_id,
          recipient_id: row.recipient_id,
          sender_name: row.sender_name,
          type: row.type,
          text: row.text,
          url: row.url,
          filename: row.filename,
          time: row.time,
          deleted: false,
        };
        if (replyToId) payload.reply_to_id = replyToId;
        if (replyPreview) payload.reply_preview = replyPreview;

        let { error } = await client.from('messages').insert([payload]);
        if (error?.code === 'PGRST204' && payload.reply_to_id) {
          // If the remote table doesn't have reply_to_id column, retry insert without it
          delete payload.reply_to_id;
          ({ error } = await client.from('messages').insert([payload]));
        }
        if (error) showToast((unpersistedChats.has(row.group_id) ? 'Mesaj yalnızca bu oturumda tutuluyor; hafıza dolu. Gönderilemedi: ' : 'Mesaj cihazda saklandı, karşı tarafa gönderilemedi: ') + error.message);
      } catch (err) {
        showToast(unpersistedChats.has(row.group_id) ? 'Cihaz hafızası dolu ve sunucu bağlantısı yok. Mesaj yalnızca bu oturumda tutuluyor.' : 'Mesaj cihazda saklandı. Sunucu bağlantısı kurulamadı.');
        console.warn('Supabase message insert background fallback:', err);
      }
    }
  };

  const handleCreateGroup = async (input: string): Promise<boolean> => {
    const name = input.trim();
    if (name.length < 2 || name.length > 70) { showToast('Kortej adı 2–70 karakter olmalı.'); return false; }
    if (Object.values(groupsRef.current).some(group => group.info.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) {
      showToast('Bu adla bir kortej zaten var.'); return false;
    }
    const id = 'group_' + crypto.randomUUID();
    const group: CortegeGroup = { id, name, avatar: '👥', color: 'from-orange-700 to-orange-500', created_by: deviceId, created_by_name: currentUser };
    const next = { ...groupsRef.current, [id]: { info: group } };
    const pending: string[] = JSON.parse(localStorage.getItem('rider_pending_groups') || '[]');
    try {
      localStorage.setItem('rider_custom_groups', JSON.stringify(next));
      localStorage.setItem('rider_pending_groups', JSON.stringify([...new Set([...pending, id])]));
    } catch { showToast('Cihaz hafızası dolu. Kortej kaydedilemedi.'); return false; }
    groupsRef.current = next; setGroups(next); broadcastLocalEvent('NEW_LOCAL_GROUP', group);
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from('rider_groups').upsert(group);
      if (!error) {
        const remaining: string[] = JSON.parse(localStorage.getItem('rider_pending_groups') || '[]');
        localStorage.setItem('rider_pending_groups', JSON.stringify(remaining.filter(key => key !== id)));
        showToast('Kortej oluşturuldu.'); return true;
      }
    }
    showToast('Kortej cihazda kaydedildi. Bağlantı gelince tekrar eşitlenecek.'); return true;
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (id === 'global') return showToast('Ortak Kortej silinemez.');
    const group = groupsRef.current[id]?.info; if (!group) return;
    const owner = group.created_by === deviceId;
    if (!window.confirm(owner ? `"${name}" korteji herkes için silinsin mi?` : `"${name}" korteji listenizden kaldırılsın mı?`)) return;
    const pending: string[] = JSON.parse(localStorage.getItem('rider_pending_groups') || '[]');
    if (owner && !pending.includes(id)) {
      const client = getSupabaseClient();
      if (!client) return showToast('Korteji sunucudan silmek için bağlantı gerekli.');
      const { error } = await client.from('rider_groups').delete().eq('id', id).eq('created_by', deviceId);
      if (error) return showToast('Kortej silinemedi. Bağlantıyı kontrol edip tekrar deneyin.');
    }
    const deleted = new Set<string>(JSON.parse(localStorage.getItem('rider_deleted_group_ids') || '[]')); deleted.add(id);
    localStorage.setItem('rider_deleted_group_ids', JSON.stringify([...deleted])); setDeletedGroupIds(deleted);
    localStorage.setItem('rider_pending_groups', JSON.stringify(pending.filter(key => key !== id)));
    const next = { ...groupsRef.current }; delete next[id]; groupsRef.current = next;
    localStorage.setItem('rider_custom_groups', JSON.stringify(next)); setGroups(next);
    clearLocalMessages(id); broadcastLocalEvent('DELETE_LOCAL_GROUP', { id });
    if (activeChatRef.current === id) { activeChatRef.current = null; setActiveChatId(null); }
    showToast(owner ? 'Kortej silindi.' : 'Kortej listenizden kaldırıldı.');
  };

  const removeRider = (id: string) => {
    const hidden = new Set(hiddenRidersRef.current); hidden.add(id); hiddenRidersRef.current = hidden;
    localStorage.setItem('rider_hidden_ids', JSON.stringify([...hidden])); setHiddenRiderIds(hidden);
    setAllRiders(prev => prev.filter(rider => rider.id !== id)); setOnlineRiders(prev => prev.filter(rider => rider.id !== id));
    const chatId = 'dm_' + [deviceId, id].sort().join('_');
    setDmContacts(prev => { const next = { ...prev }; delete next[chatId]; localStorage.setItem('rider_dm_contacts', JSON.stringify(next)); return next; });
    if (activeChatRef.current === chatId) { activeChatRef.current = null; setActiveChatId(null); }
  };

  const handleDeleteDm = (chatId: string, name: string) => {
    const id = resolveRiderId(chatId, deviceId, dmContacts[chatId]?.id);
    if (id && window.confirm(`"${name}" sürücüsü rehberinizden kaldırılsın mı? Mesaj geçmişi korunur.`)) { removeRider(id); showToast('Sürücü rehberinizden kaldırıldı.'); }
  };
  const handleHideRider = (id: string, name: string) => {
    if (window.confirm(`"${name}" sürücüsü rehberinizden kaldırılsın mı?`)) { removeRider(id); showToast('Sürücü rehberinizden kaldırıldı.'); }
  };
  const handleAddRider = (inputName: string, inputId: string): boolean => {
    const name = inputName.trim(), id = inputId.trim();
    if (name.length < 2 || name.length > 40 || !id || id.length > 200 || id.startsWith('dm_') || /\s/.test(id)) {
      showToast('Geçerli bir sürücü adı ve profil ID’si girin.'); return false;
    }
    if (id === deviceId) { showToast('Kendinizi rehbere ekleyemezsiniz.'); return false; }
    const dmId = 'dm_' + [deviceId, id].sort().join('_');
    const hidden = new Set(hiddenRidersRef.current); hidden.delete(id); hiddenRidersRef.current = hidden;
    localStorage.setItem('rider_hidden_ids', JSON.stringify([...hidden])); setHiddenRiderIds(hidden);
    setDmContacts(prev => ({ ...prev, [dmId]: { id, name } }));
    showToast(dmContacts[dmId] ? 'Sürücü bilgisi güncellendi.' : `${name} rehbere eklendi.`); void fetchOnlineRiders(); return true;
  };
  const handleRestoreHidden = () => {
    hiddenRidersRef.current = new Set(); setHiddenRiderIds(new Set());
    localStorage.setItem('rider_hidden_ids', '[]'); void fetchOnlineRiders(); showToast('Gizlenen sürücüler geri getirildi.');
  };

  useEffect(() => () => {
    const session = callSessionRef.current;
    callSessionRef.current = null;
    session?.connection.close();
    session?.stream.getTracks().forEach(track => track.stop());
    groupCallRef.current?.close();
    groupCallRef.current = null;
  }, []);

  const receiveCallSignal = async (session: NonNullable<typeof callSessionRef.current>, signal: any) => {
    if (callSessionRef.current !== session || signal.to_id !== deviceId || signal.from_id !== session.peer || signal.call_id !== session.id) return;
    const key = String(signal.id || JSON.stringify([signal.kind,signal.payload]));
    if (session.signals.has(key)) return;
    session.signals.add(key);
    try {
      if (signal.kind === 'offer') {
        const answer = await session.connection.answer(signal.payload);
        if (callSessionRef.current !== session) return;
        const client = getSupabaseClient();
        if (client) {
          const {error} = await client.from('call_signals').insert({call_id:session.id,from_id:deviceId,to_id:session.peer,kind:'answer',payload:answer});
          if (error) throw error;
        }
      } else await session.connection.receive(signal.kind,signal.payload);
    } catch (error) { session.signals.delete(key); throw error; }
  };

  const createCallSession = (id: string, peer: string, stream: MediaStream, initiator = false) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Arama için veritabanı bağlantısı gerekli.');
    const connection = new CallConnection(stream, setRemoteStream, state => {
      if (callSessionRef.current?.id !== id) return;
      if (state === 'connected') {
        const session = callSessionRef.current!; session.connectedAt ||= Date.now(); session.disconnectedAt = undefined;
        setCallConnectedAt(session.connectedAt); setCallStatusText('Bağlandı');
      }
      if (state === 'disconnected') setCallStatusText('Bağlantı yeniden kuruluyor...');
      if (state === 'failed' || state === 'disconnected') {
        const session = callSessionRef.current!;
        session.disconnectedAt ||= Date.now();
        if (session.initiator && session.restarts < 2 && session.connectedAt) {
          session.restarts++;
          void session.connection.offer({ iceRestart: true }).then(async offer => {
            if (callSessionRef.current !== session) return;
            const { error } = await client.from('call_signals').insert({call_id:id,from_id:deviceId,to_id:peer,kind:'offer',payload:offer});
            if (error) throw error;
          }).catch(error => console.warn('ICE restart:', error));
        }
        if (state === 'failed') setCallStatusText('Bağlantı kurulamadı. Ağ ve arama bağlantı ayarlarını kontrol edin.');
      }
    }, async candidate => {
      const { error } = await client.from('call_signals').insert({ call_id: id, from_id: deviceId,
        to_id: peer, kind: 'ice', payload: candidate });
      if (error) throw error;
    });
    callSessionRef.current = { id, peer, connection, stream, startedAt: Date.now(), initiator, restarts: 0, signals: new Set() };
    setCallConnectedAt(null);
    return connection;
  };

  const handleStartCall = async (target: { id: string; name: string }, type: 'audio' | 'video') => {
    if (callSessionRef.current || isCallModalOpen) return showToast('Önce mevcut aramayı sonlandırın.');
    if (!navigator.mediaDevices?.getUserMedia) return showToast('Arama için HTTPS ve mikrofon/kamera izni gerekli.');
    const targetId = resolveRiderId(target.id, deviceId, dmContacts[target.id]?.id);
    if (!targetId) return showToast('Sürücü kimliği bulunamadı. Rehberden tekrar seçin.');
    if (preparingCallRef.current) return;
    preparingCallRef.current = true;
    const generation = ++callGenerationRef.current;
    let stream: MediaStream | undefined;
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Veritabanı bağlantısı gerekli.');
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true },
        video: type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false });
      if (generation !== callGenerationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const callId = 'call_' + crypto.randomUUID();
      const connection = createCallSession(callId, targetId, stream, true);
      setLocalStream(stream); setRemoteStream(null); setCallType(type); setCallTitle(target.name);
      setCallStatusText('Aranıyor...'); setIsGroupCall(false); setIsCallModalOpen(true); setActiveCallId(callId);
      const offer = await connection.offer();
      const record: CallRecord = { id: callId, caller_id: deviceId, caller_name: currentUser,
        callee_id: targetId, callee_name: target.name, type, status: 'ringing', created_at: new Date().toISOString(), offer };
      const { error } = await client.from('calls').insert(record);
      if (error) throw error;
      if (generation !== callGenerationRef.current) {
        await client.from('calls').update({status:'ended'}).eq('id',callId); return;
      }
      setCallHistory(prev => [record, ...prev]);
    } catch (error: any) {
      stream?.getTracks().forEach(track => track.stop());
      if (generation !== callGenerationRef.current) return;
      handleEndCall(); showToast('Arama başlatılamadı: ' + error.message);
    } finally { if (generation === callGenerationRef.current) preparingCallRef.current = false; }
  };

  const openGroupCall = async (call: GroupCallRecord, stream: MediaStream) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Veritabanı bağlantısı gerekli.');
    setLocalStream(stream); setRemoteStream(null); setGroupRemoteStreams({});
    setCallType(call.type); setCallTitle(`${call.title} (Kortej Telsizi)`);
    setCallStatusText('Sürücüler bekleniyor...'); setIsGroupCall(true);
    setIsCallModalOpen(true); setActiveCallId(call.id);
    const session = new GroupCall(client, call.id, deviceId, currentUser, stream,
      call.host_id || call.caller_id || '', (id, name, remote) => {
        setGroupRemoteStreams(prev => {
          const next = { ...prev };
          if (remote) next[id] = { name, stream: remote }; else delete next[id];
          return next;
        });
        if (remote) { setCallStatusText('Korteje bağlandı'); setCallConnectedAt(prev => prev || Date.now()); }
      }, () => handleEndCall(), error => {
        console.error('Group call:', error); setCallStatusText('Kortej bağlantısı kurulamadı. Veritabanı ayarlarını kontrol edin.');
      });
    groupCallRef.current = session;
    await session.start();
  };

  const handleStartGroupCall = async (_groupId: string, groupName: string, type: 'audio' | 'video') => {
    if (callSessionRef.current || groupCallRef.current) return;
    if (preparingCallRef.current) return;
    preparingCallRef.current = true;
    const generation = ++callGenerationRef.current;
    let stream: MediaStream | undefined;
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Veritabanı bağlantısı gerekli.');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      if (generation !== callGenerationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const call: GroupCallRecord = { id: 'gcall_' + crypto.randomUUID(), title: groupName,
        host_id: deviceId, host_name: currentUser, type, status: 'active', created_at: new Date().toISOString() };
      const { error } = await client.from('group_calls').insert(call);
      if (error) throw error;
      if (generation !== callGenerationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      await openGroupCall(call, stream);
    } catch (error: any) {
      stream?.getTracks().forEach(track => track.stop());
      if (generation !== callGenerationRef.current) return;
      handleEndCall(); showToast('Grup araması başlatılamadı: ' + error.message);
    } finally { if (generation === callGenerationRef.current) preparingCallRef.current = false; }
  };

  const handleJoinGroupCall = async () => {
    if (!pendingGroupCall || callSessionRef.current || groupCallRef.current) return;
    const call = pendingGroupCall; setPendingGroupCall(null);
    if (preparingCallRef.current) return;
    preparingCallRef.current = true;
    const generation = ++callGenerationRef.current;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.type === 'video' });
      if (generation !== callGenerationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const client = getSupabaseClient();
      if (!client) throw new Error('Veritabanı bağlantısı gerekli.');
      const {data:rooms,error} = await client.from('group_calls').select('*').eq('id',call.id).limit(1);
      if (error) throw error;
      if (generation !== callGenerationRef.current || rooms?.[0]?.status !== 'active') throw new Error('Bu kortej araması sonlanmış.');
      await openGroupCall(call, stream);
    } catch (error: any) {
      stream?.getTracks().forEach(track => track.stop());
      if (generation !== callGenerationRef.current) return;
      handleEndCall(); showToast('Grup aramasına katılınamadı: ' + error.message);
    } finally { if (generation === callGenerationRef.current) preparingCallRef.current = false; }
  };

  const finishCall = (status: 'ended' | 'missed' | 'rejected' = 'ended', writeRemote = true) => {
    callGenerationRef.current++; preparingCallRef.current = false; setCallConnectedAt(null);
    const group = groupCallRef.current;
    if (group) dismissedGroupCallsRef.current.add(group.roomId);
    groupCallRef.current = null;
    group?.close();
    const session = callSessionRef.current;
    callSessionRef.current = null;
    session?.connection.close();
    session?.stream.getTracks().forEach(track => track.stop());
    const client = getSupabaseClient();
    const id = session?.id;
    if (id && client && writeRemote) void client.from('calls')
      .update({ status }).eq('id', id).then();
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null); setRemoteStream(null); setGroupRemoteStreams({});
    if (id) void dismissCallNotification(id);
    if (id) setCallHistory(prev => prev.map(call => call.id === id ? { ...call, status } : call));
    setIsCallModalOpen(false); setActiveCallId(null); setIsGroupCall(false);
  };
  const handleEndCall = () => finishCall();

  useEffect(() => {
    const timer = window.setInterval(() => {
      const session = callSessionRef.current; if (!session) return;
      if (session.disconnectedAt && Date.now() - session.disconnectedAt > 30000) { finishCall(); showToast('Bağlantı yeniden kurulamadı. Tekrar arayabilirsiniz.'); return; }
      if (session.connectedAt) return;
      const deadline = session.answeredAt ? session.answeredAt + 30000 : session.startedAt + 45000;
      if (Date.now() > deadline) { finishCall('missed'); showToast('Arama yanıtlanmadı veya bağlantı kurulamadı.'); }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!pendingCall || !soundEnabled) return;
    setCallHistory(previous => previous.some(call => call.id === pendingCall.id) ? previous : [pendingCall, ...previous]);
    soundEffects.ringTone();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') soundEffects.ringTone(); }, 3000);
    return () => clearInterval(timer);
  }, [pendingCall?.id, soundEnabled]);

  const handleAcceptIncomingCall = async () => {
    if (!pendingCall || callSessionRef.current) return;
    const call = pendingCall;
    void dismissCallNotification(call.id);
    setPendingCall(null);
    if (preparingCallRef.current) return;
    preparingCallRef.current = true;
    const generation = ++callGenerationRef.current;
    let stream: MediaStream | undefined;
    try {
      const client = getSupabaseClient();
      if (!client || !call.offer) throw new Error('Arama teklifi veya veritabanı bağlantısı yok.');
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true },
        video: call.type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false });
      if (generation !== callGenerationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const { data: latest, error: stateError } = await client.from('calls').select('*').eq('id',call.id).limit(1);
      if (stateError) throw stateError;
      if (generation !== callGenerationRef.current || latest?.[0]?.status !== 'ringing') throw new Error('Bu arama artık etkin değil.');
      const connection = createCallSession(call.id, call.caller_id, stream);
      setLocalStream(stream); setRemoteStream(null); setCallType(call.type); setCallTitle(call.caller_name);
      setCallStatusText('Bağlanıyor...'); setIsGroupCall(false); setIsCallModalOpen(true); setActiveCallId(call.id);
      const answer = await connection.answer(call.offer);
      const { data: accepted, error } = await client.from('calls').update({ status: 'connected', answer }).eq('id', call.id).eq('status','ringing').select('*');
      if (error) throw error;
      if (!accepted?.length) throw new Error('Arama iptal edilmiş veya süresi dolmuş.');
    } catch (error: any) {
      stream?.getTracks().forEach(track => track.stop());
      if (generation !== callGenerationRef.current) return;
      const client = getSupabaseClient();
      if (client) void client.from('calls').update({status:'rejected'}).eq('id',call.id).eq('status','ringing').then();
      handleEndCall(); showToast('Arama kabul edilemedi: ' + error.message);
    } finally { if (generation === callGenerationRef.current) preparingCallRef.current = false; }
  };

  const handleRejectIncomingCall = async () => {
    if (pendingCall) {
      void dismissCallNotification(pendingCall.id);
      setCallHistory(prev => prev.map(call => call.id === pendingCall.id ? {...call,status:'rejected'} : call));
      const client = getSupabaseClient();
      if (client) {
        try {
          await client.from('calls').update({ status: 'rejected' }).eq('id', pendingCall.id);
        } catch {}
      }
      setPendingCall(null);
    }
  };

  // Backup Export
  const handleExportBackup = () => {
    const data = { app: 'BizBize Riders', version: 2, username: currentUser, deviceId,
      customGroups: groups, dmContacts, messages: getAllLocalMessages(), exportDate: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `BizBizeRiders_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Cihazdaki sohbetlerin yedeği indirildi.');
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = parseBackup(String(reader.result));
        const byGroup = new Map<string, Message[]>();
        for (const message of backup.messages) {
          const list = byGroup.get(message.group_id) || []; list.push(message); byGroup.set(message.group_id, list);
        }
        for (const [id, history] of byGroup) updateLocalMessages(id, mergeMessages(getLocalMessages(id), history));
        setGroups(prev => ({ ...prev, ...backup.customGroups }));
        setDmContacts(prev => ({ ...prev, ...backup.dmContacts }));
        if (activeChatRef.current) void loadMessages(activeChatRef.current);
        setIsBackupOpen(false);
        showToast([...byGroup.keys()].some(id => unpersistedChats.has(id))
          ? 'Yedek açıldı fakat cihaz hafızası dolu. Bazı mesajlar yalnızca bu oturumda tutuluyor.'
          : 'Kortejler, rehber ve mesaj geçmişi geri yüklendi.');
      } catch (error: any) { showToast('Yedek yüklenemedi: ' + error.message); }
    };
    reader.onerror = () => showToast('Yedek dosyası okunamadı.');
    reader.readAsText(file);
  };

  useEffect(() => {
    if (!currentUser) return;
    let disposed = false;
    const openIntent = async (intent: NotificationIntent) => {
      const client = getSupabaseClient(); if (!client) return;
      if (intent.callId) {
        const {data,error} = await client.from('calls').select('*').eq('id',intent.callId).eq('callee_id',deviceId).limit(1);
        if (disposed) return;
        const call = data?.[0] as CallRecord | undefined;
        if (error || !call || call.status !== 'ringing' || Date.now() - new Date(call.created_at).getTime() > 45000) {
          showToast('Bu arama sonlanmış veya süresi dolmuş.'); void dismissCallNotification(intent.callId); return;
        }
        if (intent.action === 'reject') {
          const {error} = await client.from('calls').update({status:'rejected'}).eq('id',call.id).eq('callee_id',deviceId).eq('status','ringing');
          if (error) showToast('Arama reddedilemedi.'); else { setPendingCall(null); void dismissCallNotification(call.id); }
        } else if (!callSessionRef.current && !groupCallRef.current && !preparingCallRef.current) setPendingCall(call);
      } else if (intent.chatId) {
        const contact = dmContacts[intent.chatId]; const group = groupsRef.current[intent.chatId]?.info;
        if (contact || group) handleOpenChat(intent.chatId, contact?.name || group.name, contact ? '👤' : group.avatar);
      }
    };
    const message = (event: MessageEvent) => { if (event.data?.type === 'NOTIFICATION_INTENT') void openIntent(event.data); };
    const native = (event: Event) => void openIntent((event as CustomEvent<NotificationIntent>).detail || {});
    navigator.serviceWorker?.addEventListener('message',message);
    window.addEventListener('bizbize:notification',native);
    const url = new URL(window.location.href);
    if (url.searchParams.has('call') || url.searchParams.has('chat')) {
      void openIntent({callId:url.searchParams.get('call') || undefined,chatId:url.searchParams.get('chat') || undefined,action:url.searchParams.get('action')==='reject'?'reject':'open'});
      for (const key of ['call','chat','action']) url.searchParams.delete(key);
      window.history.replaceState({},'',url);
    }
    return () => { disposed = true; navigator.serviceWorker?.removeEventListener('message',message); window.removeEventListener('bizbize:notification',native); };
  }, [currentUser, deviceId, dmContacts]);

  // Save custom Supabase configuration
  const handleSaveSqlConfig = (url: string, key: string) => {
    localStorage.setItem('rider_supabase_url', url);
    localStorage.setItem('rider_supabase_key', key);
    initSupabase(url, key);
    setIsSqlModalOpen(false);
    showToast('Veritabanı ayarları kaydedildi!');
    registerPresence(currentUser);
  };

  return (
    <div className="app-shell w-full h-dvh flex items-center justify-center bg-black overflow-hidden font-sans select-none">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-[480px] h-full flex flex-col bg-zinc-950 relative shadow-2xl border-x border-zinc-800">
        {!currentUser ? (
          <LoginScreen
            onLogin={handleLogin}
            onOpenSqlModal={() => setIsSqlModalOpen(true)}
          />
        ) : (
          <>
            <Header
              statusText={statusText}
              isOnlineOk={isOnlineOk}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              onOpenPush={async () => { try { showToast(await enableNotifications(), 7000); } catch { showToast('Bildirim izni alınamadı.'); } }}
              onOpenCallHistory={() => setIsCallHistoryOpen(true)}
              onOpenBackup={() => setIsBackupOpen(true)}
              onOpenRiders={() => setIsRidersOpen(true)}
              onOpenSqlModal={() => setIsSqlModalOpen(true)}
              onOpenProfileSettings={() => setIsProfileSettingsOpen(true)}
              onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
              onLogout={handleLogout}
            />
            {!activeChatId ? (
              <ChatList
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                groups={groups}
                dmContacts={dmContacts}
                onlineRiders={onlineRiders}
                onOpenChat={handleOpenChat}
                onDeleteGroup={handleDeleteGroup}
                onDeleteDm={handleDeleteDm}
                onStartCall={handleStartCall}
                onHideRider={handleHideRider}
                onOpenNewGroup={() => setIsNewGroupOpen(true)}
                onOpenAddRider={() => setIsAddRiderOpen(true)}
              />
            ) : (
              <ChatRoom
                key={activeChatId}
                onError={showToast}
                chatName={activeChatName}
                chatAvatar={activeChatAvatar}
                isDm={activeChatId.startsWith('dm_')}
                messages={messages}
                currentUserId={deviceId}
                onBack={() => setActiveChatId(null)}
                onStartCall={(type) => {
                  if (activeChatId.startsWith('dm_')) {
                    let calleeId = dmContacts[activeChatId]?.id;
                    if (!calleeId) {
                      const parts = activeChatId.replace('dm_', '').split('_');
                      calleeId = parts.find((p) => p !== deviceId) || parts[0];
                    }
                    handleStartCall(
                      { id: calleeId, name: activeChatName },
                      type
                    );
                  } else {
                    handleStartGroupCall(activeChatId, activeChatName, type);
                  }
                }}
                onClearMessages={() => {
                  if (!activeChatId) return;
                  const now = Date.now();
                  localStorage.setItem(`rider_cleared_at_${activeChatId}`, String(now));
                  clearLocalMessages(activeChatId);
                  setMessages([]);
                  showToast('Tüm mesajlar kalıcı olarak temizlendi.');

                  const client = getSupabaseClient();
                  if (client) {
                    try {
                      client.from('messages').delete().eq('group_id', activeChatId).then();
                    } catch {}
                  }
                }}
                onDeleteMessage={(messageId) => {
                  if (!activeChatId) return;
                  setDeletedMsgIds((prev) => {
                    const next = new Set([...prev, messageId]);
                    localStorage.setItem('rider_deleted_msg_ids', JSON.stringify([...next]));
                    return next;
                  });

                  const updated = messages.filter(
                    (m) => String(m.id) !== messageId && `${m.sender_id}_${m.time}` !== messageId
                  );
                  setMessages(updated);
                  updateLocalMessages(activeChatId, updated);
                  showToast('Mesaj kalıcı olarak silindi.');

                  const client = getSupabaseClient();
                  if (client) {
                    try {
                      client.from('messages').delete().eq('id', messageId).then();
                    } catch {}
                  }
                }}
                onSendMessage={handleSendMessage}
                onToggleAttachMenu={() => setIsAttachOpen(!isAttachOpen)}
                onOpenMediaViewer={(url, type, filename) =>
                  setMediaViewerState({ url, type, filename })
                }
                onShowGroupMap={() => setIsGroupMapOpen(true)}
                onOpenRoadAlert={() => setIsRoadAlertOpen(true)}
                onUpdateMessage={(messageId, reactions) => {
                  const updatedMessages = messages.map(m =>
                    m.id === messageId ? { ...m, reactions } : m
                  );
                  setMessages(updatedMessages);
                  if (activeChatId) {
                    updateLocalMessages(activeChatId, updatedMessages);
                  }
                  const client = getSupabaseClient();
                  if (client && messageId) {
                      client.from('messages').update({ reactions }).eq('id', messageId).then();
                  }
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Attachments Drawer */}
      <AttachMenuDrawer
        isOpen={isAttachOpen}
        onClose={() => setIsAttachOpen(false)}
        onPickMedia={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const isVid = file.type.startsWith('video/');
            handleSendMessage(isVid ? 'video' : 'image', String(reader.result), file.name);
            setIsAttachOpen(false);
          };
          reader.readAsDataURL(file);
        }}
        onPickDoc={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            handleSendMessage('file', String(reader.result), file.name);
            setIsAttachOpen(false);
          };
          reader.readAsDataURL(file);
        }}
        onSendFixedLocation={() => {
          if (!navigator.geolocation) return showToast('Konum erişimi desteklenmiyor.');
          const request = locationGenerationRef.current;
          const chatId = activeChatId;
          navigator.geolocation.getCurrentPosition(position => {
            if (request !== locationGenerationRef.current || activeChatRef.current !== chatId) return;
            handleSendMessage('location', JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude,
              at: new Date().toISOString() }), 'Sabit Konum');
            setIsAttachOpen(false); showToast('Sabit konum gönderildi.');
          }, () => showToast('Konum alınamadı. GPS ve konum iznini kontrol edin; konum gönderilmedi.'),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 });
        }}
        onToggleLiveLocation={() => {
          if (isLiveLocationTracking) {
            locationGenerationRef.current++;
            if (liveLocationTimerRef.current !== null) clearInterval(liveLocationTimerRef.current);
            liveLocationTimerRef.current = null;
            setIsLiveLocationTracking(false); setIsAttachOpen(false);
            showToast('Canlı konum paylaşımı durduruldu.'); return;
          }
          if (!navigator.geolocation) return showToast('Konum erişimi desteklenmiyor.');
          const request = ++locationGenerationRef.current;
          const chatId = activeChatId;
          const sharePosition = () => navigator.geolocation.getCurrentPosition(position => {
            if (request !== locationGenerationRef.current || activeChatRef.current !== chatId) return;
            handleSendMessage('location', JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude,
              live: true, at: new Date().toISOString() }), 'Canlı Konum');
          }, error => {
            if (request !== locationGenerationRef.current) return;
            if (error.code === 1) {
              locationGenerationRef.current++;
              if (liveLocationTimerRef.current !== null) clearInterval(liveLocationTimerRef.current);
              liveLocationTimerRef.current = null; setIsLiveLocationTracking(false);
            }
            showToast('Konum güncellenemedi. GPS ve konum iznini kontrol edin.');
          }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 });
          liveLocationTimerRef.current = window.setInterval(sharePosition, 10000);
          setIsLiveLocationTracking(true); setIsAttachOpen(false); sharePosition();
          showToast('Canlı konum yalnızca GPS verisi alınabildiğinde paylaşılır.');
        }}
        isLiveLocationActive={isLiveLocationTracking}
        onSendVoiceNote={(audioUrl) => {
          handleSendMessage('audio', audioUrl, 'Ses Kaydı');
          setIsAttachOpen(false);
        }}
        onError={(msg) => showToast(msg)}
      />

      {/* Modals */}
      <NewGroupModal
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        onCreateGroup={handleCreateGroup}
      />

      <RidersDirectoryModal
        isOpen={isRidersOpen}
        onClose={() => setIsRidersOpen(false)}
        riders={allRiders}
        activeChatId={activeChatId}
        onOpenDmChat={(id, name) => {
          const dmId = 'dm_' + [deviceId, id].sort().join('_');
          setDmContacts((prev) => ({
            ...prev,
            [dmId]: { id, name },
          }));
          handleOpenChat(dmId, name, '👤');
        }}
        onStartCall={handleStartCall}
        onHideRider={handleHideRider}
        onRestoreHidden={handleRestoreHidden}
      />

      <CallHistoryModal
        isOpen={isCallHistoryOpen}
        onClose={() => setIsCallHistoryOpen(false)}
        calls={callHistory}
        currentUserId={deviceId}
        onDeleteCall={(id) => setCallHistory((prev) => prev.filter((c) => c.id !== id))}
        onClearAll={() => setCallHistory([])}
      />

      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onExport={handleExportBackup}
        onImport={handleImportBackup}
      />

      <IncomingCallModal
        call={pendingCall}
        onAccept={handleAcceptIncomingCall}
        onReject={handleRejectIncomingCall}
      />

      <IncomingGroupCallModal
        call={pendingGroupCall}
        onJoin={handleJoinGroupCall}
        onDismiss={() => { if (pendingGroupCall) dismissedGroupCallsRef.current.add(pendingGroupCall.id); setPendingGroupCall(null); }}
      />

      <CallScreenModal
        isOpen={isCallModalOpen}
        callType={callType}
        title={callTitle}
        statusText={callStatusText}
        isGroupCall={isGroupCall}
        localStream={localStream}
        remoteStream={remoteStream}
        groupRemoteStreams={groupRemoteStreams}
        connectedAt={callConnectedAt}
        peerConnection={callSessionRef.current?.connection.pc}
        onEndCall={handleEndCall}
      />

      <MediaViewer
        url={mediaViewerState.url}
        type={mediaViewerState.type}
        filename={mediaViewerState.filename}
        onClose={() => setMediaViewerState({ url: null, type: null })}
      />

      <SqlSetupModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
        onSaveConfig={handleSaveSqlConfig}
      />
      <AddRiderModal
        isOpen={isAddRiderOpen}
        onClose={() => setIsAddRiderOpen(false)}
        onAddRider={handleAddRider}
      />
      <ProfileSettingsModal
        isOpen={isProfileSettingsOpen}
        onClose={() => setIsProfileSettingsOpen(false)}
        deviceId={deviceId}
        currentName={currentUser}
        currentAvatar={userAvatar}
        onSave={(name, avatar) => {
          setUsername(name);
          setCurrentUser(name);
          if (avatar) {
            localStorage.setItem('rider_avatar', avatar);
            setUserAvatar(avatar);
          } else {
            localStorage.removeItem('rider_avatar');
            setUserAvatar(null);
          }
          showToast('Profil güncellendi!');
        }}
      />
      <GroupMapModal
        isOpen={isGroupMapOpen}
        onClose={() => setIsGroupMapOpen(false)}
        messages={messages}
      />
      <RoadAlertModal
        isOpen={isRoadAlertOpen}
        onClose={() => setIsRoadAlertOpen(false)}
        onSendAlert={(alert) => handleSendMessage('text', alert)}
      />
      {isVoiceAssistantOpen && (
        <VoiceAssistantModal
          isOpen={isVoiceAssistantOpen}
          onClose={() => setIsVoiceAssistantOpen(false)}
          activeChatId={activeChatId}
          activeChatName={activeChatName}
          onSendMessage={(text) => handleSendMessage('text', text)}
          onOpenGroupMap={() => setIsGroupMapOpen(true)}
          onOpenRoadAlert={() => setIsRoadAlertOpen(true)}
          onOpenRiders={() => setIsRidersOpen(true)}
          onBackToChatList={() => setActiveChatId(null)}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          soundEnabled={soundEnabled}
          onStartCall={(type) => {
            if (activeChatId) {
              handleStartCall({ id: activeChatId, name: activeChatName }, type);
            }
          }}
        />
      )}

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw] bg-zinc-900 border border-orange-500 text-white px-4 py-3 rounded-2xl shadow-2xl z-[1000] flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom duration-200">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
