import type { LocationData, Message } from '../types';

export function latestLiveLocations(messages: Message[], now: number): Message[] {
  const latest = new Map<string, Message>();
  for (const message of messages) {
    if (message.type !== 'location' || !message.url) continue;
    if (!latest.has(message.sender_id) || latest.get(message.sender_id)!.time <= message.time) latest.set(message.sender_id, message);
  }
  return [...latest.values()].filter(message => {
    try {
      const point: LocationData = JSON.parse(message.url!);
      return !message.deleted && point.live === true && Number.isFinite(point.lat) && Number.isFinite(point.lng)
        && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 && Number.isFinite(message.time)
        && now - message.time >= -30000 && now - message.time <= 120000;
    } catch { return false; }
  });
}

export function escapeMapText(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}
