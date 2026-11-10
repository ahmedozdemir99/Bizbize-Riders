import { Message, CortegeGroup, DirectContact, UserProfile } from '../types';

const LOCAL_MSG_KEY_PREFIX = 'rider_messages_';

// BroadcastChannel for cross-tab realtime messaging fallback
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('bizbize_riders_local_channel');
  }
} catch {
  broadcastChannel = null;
}

export function subscribeLocalBroadcast(onMessageReceived: (data: any) => void) {
  if (!broadcastChannel) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data) onMessageReceived(e.data);
  };
  broadcastChannel.addEventListener('message', handler);
  return () => {
    broadcastChannel?.removeEventListener('message', handler);
  };
}

export function broadcastLocalEvent(type: string, payload: any) {
  try {
    broadcastChannel?.postMessage({ type, payload });
  } catch (err) {
    console.warn('Broadcast local event error:', err);
  }
}

export function getLocalMessages(groupId: string): Message[] {
  try {
    const raw = localStorage.getItem(LOCAL_MSG_KEY_PREFIX + groupId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalMessage(groupId: string, message: Message): Message[] {
  const existing = getLocalMessages(groupId);
  const updated = [...existing, message];
  try {
    localStorage.setItem(LOCAL_MSG_KEY_PREFIX + groupId, JSON.stringify(updated.slice(-500)));
  } catch (err) {
    console.warn('Failed to save local message:', err);
  }
  broadcastLocalEvent('NEW_LOCAL_MESSAGE', message);
  return updated;
}

export function updateLocalMessages(groupId: string, messages: Message[]): void {
  try {
    localStorage.setItem(LOCAL_MSG_KEY_PREFIX + groupId, JSON.stringify(messages.slice(-500)));
  } catch (err) {
    console.warn('Failed to update local messages:', err);
  }
}

export function clearLocalMessages(groupId: string): void {
  try {
    localStorage.removeItem(LOCAL_MSG_KEY_PREFIX + groupId);
  } catch (err) {
    console.warn('Failed to clear local messages:', err);
  }
  broadcastLocalEvent('CLEAR_LOCAL_MESSAGES', { groupId });
}
