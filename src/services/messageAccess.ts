import type { Message } from '../types';

/** Prevent unrelated direct messages from appearing in rider notifications. */
export function isMessageForRider(message: Message, deviceId: string): boolean {
  if (message.recipient_id) return message.recipient_id === deviceId || message.sender_id === deviceId;
  if (!message.group_id.startsWith('dm_')) return true;
  const pair = message.group_id.slice(3);
  return pair.startsWith(deviceId + '_') || pair.endsWith('_' + deviceId);
}
