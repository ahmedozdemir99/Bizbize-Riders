import type { CortegeGroup, DirectContact, Message } from '../types';

export function parseBackup(raw: string): {
  customGroups: Record<string, { info: CortegeGroup }>;
  dmContacts: Record<string, DirectContact>;
  messages: Message[];
} {
  const value = JSON.parse(raw);
  const record = (item: unknown) => !!item && typeof item === 'object' && !Array.isArray(item);
  if (!record(value) || value.app !== 'BizBize Riders' || value.version !== 2 ||
    !record(value.customGroups) || !record(value.dmContacts) || !Array.isArray(value.messages)) {
    throw new Error('Geçerli bir BizBize Riders v2 yedeği seçin.');
  }
  for (const [id, group] of Object.entries(value.customGroups) as [string, any][]) {
    if (!id || !record(group?.info) || typeof group.info.name !== 'string') throw new Error('Yedekteki kortej bilgileri geçersiz.');
  }
  for (const contact of Object.values(value.dmContacts) as any[]) {
    if (!record(contact) || typeof contact.id !== 'string' || !contact.id || typeof contact.name !== 'string') throw new Error('Yedekteki rehber bilgileri geçersiz.');
  }
  const types = new Set(['text','image','video','audio','file','location']);
  for (const message of value.messages) {
    if (!record(message) || typeof message.group_id !== 'string' || !message.group_id ||
      typeof message.sender_id !== 'string' || typeof message.sender_name !== 'string' ||
      !Number.isFinite(message.time) || !types.has(message.type)) throw new Error('Yedekteki mesaj bilgileri geçersiz.');
  }
  return value;
}
