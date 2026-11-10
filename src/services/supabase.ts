import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://iczmxwdhyaicedbbjwzb.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_aWRwavolbCP5ShbAWUg-TA_63Pfb8p3';

let clientInstance: SupabaseClient | null = null;

export function getStoredSupabaseConfig(): { url: string; key: string } {
  const url = localStorage.getItem('rider_supabase_url') || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem('rider_supabase_key') || DEFAULT_SUPABASE_KEY;
  return { url, key };
}

export function initSupabase(customUrl?: string, customKey?: string): SupabaseClient | null {
  const { url, key } = customUrl && customKey 
    ? { url: customUrl, key: customKey } 
    : getStoredSupabaseConfig();

  if (!url || !key || !url.startsWith('https://')) {
    clientInstance = null;
    return null;
  }

  try {
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return clientInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    clientInstance = null;
    return null;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!clientInstance) {
    return initSupabase();
  }
  return clientInstance;
}

export function getDeviceId(): string {
  let deviceId = localStorage.getItem('rider_device_id');
  if (!deviceId) {
    deviceId = 'rider_' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem('rider_device_id', deviceId);
  }
  return deviceId;
}

export function getUsername(): string {
  return (localStorage.getItem('rider_username') || '').trim();
}

export function setUsername(name: string): void {
  localStorage.setItem('rider_username', name.trim());
}

// SQL Schema Generator script for users to setup their Supabase database easily
export const SUPABASE_SQL_SCHEMA = `-- BizBize Riders Supabase DDL SQL Schema (Tam Güvenli / Tekrar Çalıştırılabilir)
-- Bu kodu Supabase SQL Editor bölümüne yapıştırıp "Run" butonuna basın.

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  online BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all profiles" ON public.profiles;
CREATE POLICY "Allow public all profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. Rider Groups Table
CREATE TABLE IF NOT EXISTS public.rider_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '👥',
  color TEXT DEFAULT 'from-orange-700 to-orange-500',
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.rider_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all rider_groups" ON public.rider_groups;
CREATE POLICY "Allow public all rider_groups" ON public.rider_groups FOR ALL USING (true) WITH CHECK (true);

-- 3. Group Members Table
CREATE TABLE IF NOT EXISTS public.rider_group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  added_by TEXT,
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE public.rider_group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all group_members" ON public.rider_group_members;
CREATE POLICY "Allow public all group_members" ON public.rider_group_members FOR ALL USING (true) WITH CHECK (true);

-- 4. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGSERIAL PRIMARY KEY,
  group_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT,
  sender_name TEXT NOT NULL,
  type TEXT NOT NULL,
  text TEXT,
  url TEXT,
  filename TEXT,
  time BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted BOOLEAN DEFAULT false
);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all messages" ON public.messages;
CREATE POLICY "Allow public all messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- 5. Calls Table
CREATE TABLE IF NOT EXISTS public.calls (
  id TEXT PRIMARY KEY,
  caller_id TEXT NOT NULL,
  caller_name TEXT NOT NULL,
  callee_id TEXT NOT NULL,
  callee_name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  offer JSONB,
  answer JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all calls" ON public.calls;
CREATE POLICY "Allow public all calls" ON public.calls FOR ALL USING (true) WITH CHECK (true);

-- 6. Call Signals Table (WebRTC 1-on-1)
CREATE TABLE IF NOT EXISTS public.call_signals (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all call_signals" ON public.call_signals;
CREATE POLICY "Allow public all call_signals" ON public.call_signals FOR ALL USING (true) WITH CHECK (true);

-- 7. Group Calls Table
CREATE TABLE IF NOT EXISTS public.group_calls (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.group_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all group_calls" ON public.group_calls;
CREATE POLICY "Allow public all group_calls" ON public.group_calls FOR ALL USING (true) WITH CHECK (true);

-- 8. Group Call Members Table
CREATE TABLE IF NOT EXISTS public.group_call_members (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);
ALTER TABLE public.group_call_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all group_call_members" ON public.group_call_members;
CREATE POLICY "Allow public all group_call_members" ON public.group_call_members FOR ALL USING (true) WITH CHECK (true);

-- 9. Group Call Signals Table (WebRTC Multi-Peer)
CREATE TABLE IF NOT EXISTS public.group_call_signals (
  id BIGSERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.group_call_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all group_call_signals" ON public.group_call_signals;
CREATE POLICY "Allow public all group_call_signals" ON public.group_call_signals FOR ALL USING (true) WITH CHECK (true);

-- Explicit Grants for Public / Anonymous API access
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, postgres, service_role;

-- Safe Realtime Publication Enabler
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_calls;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_call_members;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_call_signals;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_groups;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
`;
