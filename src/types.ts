export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';

export interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  live?: boolean;
  at?: string;
  address?: string;
}

export interface Message {
  id?: string;
  group_id: string;
  sender_id: string;
  recipient_id?: string | null;
  sender_name: string;
  type: MessageType;
  text?: string | null;
  url?: string | null;
  filename?: string | null;
  time: number;
  created_at?: string;
  deleted?: boolean;
  reactions?: string[];
  read_by?: string[];
  reply_to_id?: string;
  reply_preview?: {
    sender_name: string;
    text?: string | null;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  online: boolean;
  updated_at?: string;
  avatar?: string;
}

export interface CortegeGroup {
  id: string;
  name: string;
  avatar: string;
  color: string;
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
}

export interface DirectContact {
  id: string;
  name: string;
  avatar?: string;
  lastSeen?: string;
}

export type CallStatus = 'ringing' | 'connected' | 'rejected' | 'ended' | 'missed';
export type CallType = 'audio' | 'video';

export interface CallRecord {
  id: string;
  caller_id: string;
  caller_name: string;
  callee_id: string;
  callee_name: string;
  type: CallType;
  status: CallStatus;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  created_at: string;
}

export interface GroupCallRecord {
  id: string;
  title: string;
  group_id?: string;
  caller_id?: string;
  caller_name?: string;
  host_id?: string;
  host_name?: string;
  type: CallType;
  status: 'active' | 'ringing' | 'connected' | 'ended';
  created_at: string;
}

export interface BackupData {
  app: string;
  version: number;
  username: string;
  deviceId: string;
  customGroups: Record<string, { info: { name: string; avatar: string; color: string; createdBy?: string } }>;
  dmContacts: Record<string, DirectContact>;
  messages: Message[];
  exportDate: string;
}
