import { Message, CortegeGroup, DirectContact, UserProfile } from '../types';

const LOCAL_MSG_KEY_PREFIX = 'rider_messages_';
const memoryMessages = new Map<string, Message[]>();
export const unpersistedChats = new Set<string>();

export function mergeMessages(...lists: Message[][]): Message[] {
  const entries = new Map<string, Message>();
  for (const list of lists) for (const message of list) {
    const key = `${message.sender_id}_${message.time}`;
    entries.set(key, { ...entries.get(key), ...message });
  }
  return [...entries.values()].sort((a, b) => a.time - b.time);
}

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
    const stored = raw ? JSON.parse(raw) : [];
    return mergeMessages(Array.isArray(stored) ? stored : [], memoryMessages.get(groupId) || []);
  } catch {
    return memoryMessages.get(groupId) || [];
  }
}

export function saveLocalMessage(groupId: string, message: Message): Message[] {
  const existing = getLocalMessages(groupId);
  const updated = mergeMessages(existing, [message]);
  memoryMessages.set(groupId, updated.slice(-500));
  try {
    localStorage.setItem(LOCAL_MSG_KEY_PREFIX + groupId, JSON.stringify(updated.slice(-500)));
    unpersistedChats.delete(groupId);
  } catch (err) {
    unpersistedChats.add(groupId);
    console.warn('Failed to save local message:', err);
  }
  broadcastLocalEvent('NEW_LOCAL_MESSAGE', message);
  return updated;
}

export function updateLocalMessages(groupId: string, messages: Message[]): void {
  memoryMessages.set(groupId, messages.slice(-500));
  try {
    localStorage.setItem(LOCAL_MSG_KEY_PREFIX + groupId, JSON.stringify(messages.slice(-500)));
    unpersistedChats.delete(groupId);
  } catch (err) {
    unpersistedChats.add(groupId);
    console.warn('Failed to update local messages:', err);
  }
}

export function clearLocalMessages(groupId: string): void {
  memoryMessages.delete(groupId);
  unpersistedChats.delete(groupId);
  try {
    localStorage.removeItem(LOCAL_MSG_KEY_PREFIX + groupId);
  } catch (err) {
    console.warn('Failed to clear local messages:', err);
  }
  broadcastLocalEvent('CLEAR_LOCAL_MESSAGES', { groupId });
}

export function getAllLocalMessages(): Message[] {
  const groups = new Set(memoryMessages.keys());
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LOCAL_MSG_KEY_PREFIX)) groups.add(key.slice(LOCAL_MSG_KEY_PREFIX.length));
  }
  return [...groups].flatMap(group => getLocalMessages(group));
}
