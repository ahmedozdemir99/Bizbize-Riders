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
import { soundEffects } from './services/sound';
import { 
  getLocalMessages, 
  saveLocalMessage, 
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
  const [groups, setGroups] = useState<Record<string, { info: CortegeGroup }>>(() => {
    try {
      const saved = localStorage.getItem('rider_custom_groups');
      return saved ? { ...DEFAULT_GROUPS, ...JSON.parse(saved) } : DEFAULT_GROUPS;
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
  const [messages, setMessages] = useState<Message[]>([]);

  // Modals state
  const [isAttachOpen, setIsAttachOpen] = useState<boolean>(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState<boolean>(false);
  const [isRidersOpen, setIsRidersOpen] = useState<boolean>(false);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState<boolean>(false);
  const [isBackupOpen, setIsBackupOpen] = useState<boolean>(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);

  // Lightbox Media Viewer
  const [mediaViewerState, setMediaViewerState] = useState<{
    url: string | null;
    type: 'image' | 'video' | null;
    filename?: string | null;
  }>({ url: null, type: null });

  // Calls history & incoming calls
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [pendingCall, setPendingCall] = useState<CallRecord | null>(null);
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

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

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
      if (currentUser) registerPresence(currentUser);
    }, 25000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Subscribe to local BroadcastChannel for tab-to-tab sync
  useEffect(() => {
    const unsubscribe = subscribeLocalBroadcast((data) => {
      if (data.type === 'NEW_LOCAL_MESSAGE' && data.payload) {
        const m: Message = data.payload;
        if (activeChatId && m.group_id === activeChatId) {
          loadMessages(activeChatId);
        } else if (m.sender_id !== deviceId) {
          if (soundEnabled) soundEffects.messageChime();
          showToast(`${m.sender_name || 'Rider'}: ${m.text || 'Yeni mesaj'}`);
        }
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
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { data, error } = await client
        .from('rider_groups')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(300);

      if (error || !data) return;

      const newGroups: Record<string, { info: CortegeGroup }> = { ...DEFAULT_GROUPS };
      data.forEach((g: any) => {
        newGroups[g.id] = {
          info: {
            id: g.id,
            name: g.name || 'Kortej',
            avatar: g.avatar || '👥',
            color: g.color || 'from-orange-700 to-orange-500',
            created_by: g.created_by,
          },
        };
      });
      setGroups(newGroups);
    } catch (e) {
      console.warn('Sync groups offline fallback');
    }
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
            !hiddenRiderIds.has(String(u.id)) &&
            u.online &&
            u.updated_at &&
            Date.now() - new Date(u.updated_at).getTime() < 70000
        );
        setOnlineRiders(filtered);
        setAllRiders(data.filter((u) => !hiddenRiderIds.has(String(u.id))));
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
            if (activeChatId && m.group_id === activeChatId) {
              loadMessages(activeChatId);
            } else if (m.sender_id !== deviceId) {
              if (soundEnabled) soundEffects.messageChime();
              showToast(`${m.sender_name || 'Bir sürücü'}: ${m.text || 'Yeni bir ek gönderildi'}`);
            }
          }
        )
        .subscribe();

      // Calls channel
      const callChannel = client
        .channel(`app-calls-${deviceId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'calls' },
          (payload: any) => {
            const c: CallRecord = payload.new;
            if (c.callee_id === deviceId && c.status === 'ringing') {
              setPendingCall(c);
              if (soundEnabled) soundEffects.ringTone();
            }
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(msgChannel);
        client.removeChannel(callChannel);
      };
    } catch {
      console.warn('Realtime subscription offline fallback');
    }
  }, [currentUser, activeChatId, deviceId, soundEnabled]);

  // Load Messages (tries Supabase first, merges/falls back to LocalStore)
  const loadMessages = async (groupId: string) => {
    const localMsgs = getLocalMessages(groupId);
    const client = getSupabaseClient();
    
    if (!client) {
      setMessages(localMsgs);
      return;
    }

    try {
      const { data, error } = await client
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .order('time', { ascending: true })
        .limit(500);

      if (!error && data) {
        // Merge server and local messages cleanly by time
        const map = new Map<string, Message>();
        localMsgs.forEach((m) => map.set(`${m.sender_id}_${m.time}`, m));
        data.forEach((m: Message) => map.set(`${m.sender_id}_${m.time}`, m));
        const merged = Array.from(map.values()).sort((a, b) => a.time - b.time);
        setMessages(merged);
      } else {
        setMessages(localMsgs);
      }
    } catch (e) {
      setMessages(localMsgs);
    }
  };

  const handleLogin = (name: string) => {
    setUsername(name);
    setCurrentUser(name);
    if (soundEnabled) soundEffects.revEngine();
    showToast(`Hoş geldin, ${name}! Kontağı çevirdin.`);
    registerPresence(name);
  };

  const handleLogout = async () => {
    if (!window.confirm('Çıkış yapmak istediğinize emin misiniz?')) return;
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('profiles').upsert({
          id: deviceId,
          name: currentUser,
          online: false,
          updated_at: new Date().toISOString(),
        });
      } catch {}
    }
    localStorage.removeItem('rider_username');
    setCurrentUser('');
    setActiveChatId(null);
  };

  const handleOpenChat = (id: string, name: string, avatar: string) => {
    setActiveChatId(id);
    setActiveChatName(name);
    setActiveChatAvatar(avatar);
    loadMessages(id);
  };

  const handleSendMessage = async (type: MessageType, content: string, filename?: string) => {
    if (!activeChatId || !currentUser) return;

    const directRecipient = activeChatId.startsWith('dm_') ? dmContacts[activeChatId]?.id : null;

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
    };

    // Always persist to local store first
    saveLocalMessage(activeChatId, row);
    loadMessages(activeChatId);
    if (soundEnabled) soundEffects.click();

    // Try background insert to Supabase if connected
    const client = getSupabaseClient();
    if (client) {
      try {
        const { error } = await client.from('messages').insert([row]);
        if (error) {
          setStatusText('Yerel Mod (Sunucu Çevrimdışı)');
          setIsOnlineOk(false);
        }
      } catch (err) {
        setStatusText('Yerel Mod (Sunucu Çevrimdışı)');
        setIsOnlineOk(false);
      }
    }
  };

  const handleCreateGroup = async (name: string) => {
    const id = 'group_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
    const newRow: CortegeGroup = {
      id,
      name,
      avatar: '👥',
      color: 'from-orange-700 to-orange-500',
      created_by: deviceId,
      created_by_name: currentUser,
    };

    // Always update local state immediately
    setGroups((prev) => ({
      ...prev,
      [id]: { info: newRow },
    }));
    broadcastLocalEvent('NEW_LOCAL_GROUP', newRow);

    const client = getSupabaseClient();
    if (!client) {
      showToast('Kortej yerel hafızaya kaydedildi (Sunucu bağlantısı yok).');
      return;
    }

    try {
      const { error } = await client.from('rider_groups').insert([newRow]);
      if (error) {
        showToast('Kortej yerel hafızaya kaydedildi (Sunucu senkronizasyon uyarısı).');
        setStatusText('Yerel Mod (Sunucu Çevrimdışı)');
        setIsOnlineOk(false);
      } else {
        showToast('Yeni kortej oluşturuldu ve sunucuya kaydedildi!');
        setStatusText('Supabase bağlantısı hazır');
        setIsOnlineOk(true);
      }
    } catch (e: any) {
      showToast('Kortej yerel cihazınıza kaydedildi.');
      setStatusText('Yerel Mod (Sunucu Çevrimdışı)');
      setIsOnlineOk(false);
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (id === 'global') {
      showToast('Ortak Kortej silinemez.');
      return;
    }
    if (!window.confirm(`"${name}" korteji silinsin mi?`)) return;

    setGroups((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    if (activeChatId === id) setActiveChatId(null);
    showToast('Kortej silindi.');

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('rider_groups').delete().eq('id', id);
      } catch {}
    }
  };

  const handleDeleteDm = (id: string, name: string) => {
    if (!window.confirm(`"${name}" kişi sohbeti listeden kaldırılsın mı?`)) return;
    setDmContacts((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (activeChatId === id) setActiveChatId(null);
    showToast('Sohbet listeden kaldırıldı.');
  };

  const handleHideRider = (id: string, name: string) => {
    if (!window.confirm(`"${name}" bu cihazdaki listeden kaldırılsın mı?`)) return;
    setHiddenRiderIds((prev) => new Set([...prev, id]));
    showToast('Rider gizlendi.');
  };

  const handleRestoreHidden = () => {
    setHiddenRiderIds(new Set());
    showToast('Gizlenen Rider kayıtları geri getirildi.');
  };

  // WebRTC 1-on-1 Call Start
  const handleStartCall = async (target: { id: string; name: string }, type: 'audio' | 'video') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Arama için kamera/mikrofon ve HTTPS izni gereklidir.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: type === 'video',
      });

      setLocalStream(stream);
      setCallType(type);
      setCallTitle(target.name);
      setCallStatusText('Aranıyor...');
      setIsGroupCall(false);
      setIsCallModalOpen(true);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        if (e.streams[0]) setRemoteStream(e.streams[0]);
      };

      pc.onconnectionstatechange = () => {
        setCallStatusText(pc.connectionState);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callId = 'call_' + Date.now();
      setActiveCallId(callId);

      const client = getSupabaseClient();
      if (client) {
        try {
          await client.from('calls').insert([
            {
              id: callId,
              caller_id: deviceId,
              caller_name: currentUser,
              callee_id: target.id,
              callee_name: target.name,
              type,
              status: 'ringing',
              offer: { type: offer.type, sdp: offer.sdp },
            },
          ]);
        } catch {}
      }
    } catch (err: any) {
      showToast('Arama başlatılamadı: ' + err.message);
      handleEndCall();
    }
  };

  const handleEndCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      setRemoteStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsCallModalOpen(false);
    setActiveCallId(null);
  };

  const handleAcceptIncomingCall = async () => {
    if (!pendingCall) return;
    const call = pendingCall;
    setPendingCall(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: call.type === 'video',
      });

      setLocalStream(stream);
      setCallType(call.type);
      setCallTitle(call.caller_name);
      setCallStatusText('Bağlanıyor...');
      setIsCallModalOpen(true);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        if (e.streams[0]) setRemoteStream(e.streams[0]);
      };

      if (call.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const client = getSupabaseClient();
        if (client) {
          try {
            await client
              .from('calls')
              .update({ status: 'connected', answer: { type: answer.type, sdp: answer.sdp } })
              .eq('id', call.id);
          } catch {}
        }
      }
    } catch (e: any) {
      showToast('Arama kabul edilemedi: ' + e.message);
    }
  };

  const handleRejectIncomingCall = async () => {
    if (pendingCall) {
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
  const handleExportBackup = async () => {
    const client = getSupabaseClient();
    let serverMessages: Message[] = [];
    if (client) {
      try {
        const { data } = await client.from('messages').select('*').limit(3000);
        if (data) serverMessages = data;
      } catch {}
    }

    const data = {
      app: 'BizBize Riders',
      version: 2,
      username: currentUser,
      deviceId,
      customGroups: groups,
      dmContacts,
      messages: serverMessages.length ? serverMessages : getLocalMessages(activeChatId || 'global'),
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BizBizeRiders_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Yedek JSON dosyası indirildi.');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const json = JSON.parse(String(reader.result));
        if (json.customGroups) {
          setGroups((prev) => ({ ...prev, ...json.customGroups }));
        }
        if (json.dmContacts) {
          setDmContacts((prev) => ({ ...prev, ...json.dmContacts }));
        }
        showToast('Yedek başarıyla yüklendi!');
        setIsBackupOpen(false);
      } catch (err) {
        showToast('Yedek yükleme hatası: Geçersiz JSON dosyası.');
      }
    };
    reader.readAsText(file);
  };

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
    <div className="w-full h-dvh flex items-center justify-center bg-black overflow-hidden font-sans select-none">
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
              onOpenPush={() => showToast('PWA bildirimleri aktif.')}
              onOpenCallHistory={() => setIsCallHistoryOpen(true)}
              onOpenBackup={() => setIsBackupOpen(true)}
              onOpenRiders={() => setIsRidersOpen(true)}
              onOpenSqlModal={() => setIsSqlModalOpen(true)}
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
              />
            ) : (
              <ChatRoom
                chatName={activeChatName}
                chatAvatar={activeChatAvatar}
                isDm={activeChatId.startsWith('dm_')}
                messages={messages}
                currentUserId={deviceId}
                onBack={() => setActiveChatId(null)}
                onStartCall={(type) =>
                  handleStartCall(
                    { id: activeChatId, name: activeChatName },
                    type
                  )
                }
                onClearMessages={() => {
                  clearLocalMessages(activeChatId);
                  setMessages([]);
                  showToast('Mesajlar temizlendi.');
                }}
                onSendMessage={handleSendMessage}
                onToggleAttachMenu={() => setIsAttachOpen(!isAttachOpen)}
                onOpenMediaViewer={(url, type, filename) =>
                  setMediaViewerState({ url, type, filename })
                }
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
          if (!navigator.geolocation) return showToast('Konum erişimi yok.');
          navigator.geolocation.getCurrentPosition(
            (p) => {
              const locData = {
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                at: new Date().toISOString(),
              };
              handleSendMessage('location', JSON.stringify(locData), 'Sabit Konum');
              setIsAttachOpen(false);
              showToast('Sabit konum gönderildi!');
            },
            () => showToast('Konum alınamadı.')
          );
        }}
        onToggleLiveLocation={() => {
          if (!navigator.geolocation) return showToast('Konum erişimi yok.');
          navigator.geolocation.getCurrentPosition(
            (p) => {
              const locData = {
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                live: true,
                at: new Date().toISOString(),
              };
              handleSendMessage('location', JSON.stringify(locData), 'Canlı Konum');
              setIsAttachOpen(false);
              showToast('Canlı konum mesajı paylaşıldı!');
            },
            () => showToast('Konum alınamadı.')
          );
        }}
        isLiveLocationActive={false}
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
        onJoin={() => setIsCallModalOpen(true)}
        onDismiss={() => setPendingGroupCall(null)}
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
