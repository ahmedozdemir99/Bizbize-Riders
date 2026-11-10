import type { SupabaseClient } from '@supabase/supabase-js';
import { CallConnection } from './callConnection';

/** One peer connection per remote rider. Signaling is durable, with polling fallback. */
export class GroupCall {
  private peers = new Map<string, CallConnection>();
  private handled = new Set<string>();
  private timer?: ReturnType<typeof setInterval>;
  private closed = false;
  private polling = false;
  constructor(private client: SupabaseClient, readonly roomId: string, private userId: string,
    private name: string, readonly stream: MediaStream, readonly hostId: string,
    private onRemote: (id: string, name: string, stream: MediaStream | null) => void,
    private onEnded: () => void, private onError: (error: unknown) => void) {}

  private async send(to: string, kind: string, payload: unknown) {
    const { error } = await this.client.from('group_call_signals').insert({
      room_id: this.roomId, from_id: this.userId, to_id: to, kind, payload });
    if (error) throw error;
  }

  private peer(id: string, name: string) {
    let peer = this.peers.get(id);
    if (!peer) {
      peer = new CallConnection(this.stream, stream => this.onRemote(id, name, stream),
        () => {}, candidate => this.send(id, 'ice', candidate));
      this.peers.set(id, peer);
    }
    return peer;
  }

  async start() {
    const { error } = await this.client.from('group_call_members').upsert({ room_id: this.roomId,
      user_id: this.userId, user_name: this.name, joined_at: new Date().toISOString(), left_at: null });
    if (error) throw error;
    if (this.closed) return;
    await this.poll();
    if (this.closed) return;
    this.timer = setInterval(() => void this.poll(), 1500);
  }

  private async poll() {
    if (this.closed || this.polling) return;
    this.polling = true;
    try {
      const { data: rooms, error: roomError } = await this.client.from('group_calls').select('*').eq('id', this.roomId);
      if (roomError) throw roomError;
      if (this.closed) return;
      if (rooms?.[0]?.status === 'ended') { this.onEnded(); return; }
      const { data: members, error } = await this.client.from('group_call_members').select('*')
        .eq('room_id', this.roomId).is('left_at', null);
      if (error) throw error;
      if (this.closed) return;
      const active = new Map<string, string>((members || []).filter(m => m.user_id !== this.userId)
        .map(m => [m.user_id, m.user_name || 'Rider']));
      for (const [id, peer] of this.peers) if (!active.has(id)) {
        peer.close(); this.peers.delete(id); this.onRemote(id, '', null);
      }
      // A deterministic offerer avoids two simultaneous offers (glare).
      for (const [id, name] of active) if (this.userId < id && !this.peers.has(id)) {
        const peer = this.peer(id, name);
        try { await this.send(id, 'offer', await peer.offer()); }
        catch (error) { peer.close(); this.peers.delete(id); throw error; }
      }
      const { data: signals, error: signalError } = await this.client.from('group_call_signals').select('*')
        .eq('room_id', this.roomId).eq('to_id', this.userId).order('id');
      if (signalError) throw signalError;
      if (this.closed) return;
      for (const signal of signals || []) {
        if (this.handled.has(String(signal.id)) || !active.has(signal.from_id)) continue;
        const peer = this.peer(signal.from_id, active.get(signal.from_id)!);
        if (signal.kind === 'offer') await this.send(signal.from_id, 'answer', await peer.answer(signal.payload));
        else await peer.receive(signal.kind, signal.payload);
        this.handled.add(String(signal.id));
      }
    } catch (error) { if (!this.closed) this.onError(error); }
    finally { this.polling = false; }
  }

  close() {
    this.closed = true;
    clearInterval(this.timer);
    this.peers.forEach(peer => peer.close()); this.peers.clear();
    this.stream.getTracks().forEach(track => track.stop());
    void this.client.from('group_call_members').update({ left_at: new Date().toISOString() })
      .eq('room_id', this.roomId).eq('user_id', this.userId).then();
    if (this.hostId === this.userId) void this.client.from('group_calls').update({ status: 'ended' })
      .eq('id', this.roomId).then();
  }
}
