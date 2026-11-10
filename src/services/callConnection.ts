/** Queues signaling until the peer is ready and serializes SDP/ICE updates. */
export class CallConnection {
  readonly pc: RTCPeerConnection;
  private pending: RTCIceCandidateInit[] = [];
  private chain: Promise<void> = Promise.resolve();
  private closed = false;
  private seen = new Set<string>();

  constructor(stream: MediaStream, onRemote: (stream: MediaStream) => void,
    onState: (state: RTCPeerConnectionState) => void,
    sendIce: (candidate: RTCIceCandidateInit) => Promise<void>) {
    this.pc = new RTCPeerConnection(getRtcConfiguration());
    stream.getTracks().forEach(track => this.pc.addTrack(track, stream));
    const remote = new MediaStream();
    this.pc.ontrack = event => {
      // Some browsers emit streamless track events.
      if (!remote.getTracks().some(track => track.id === event.track.id)) remote.addTrack(event.track);
      onRemote(event.streams[0] || remote);
    };
    this.pc.onconnectionstatechange = () => onState(this.pc.connectionState);
    this.pc.onicecandidate = event => {
      if (event.candidate && !this.closed) void sendIce(event.candidate.toJSON()).catch(console.error);
    };
  }

  private serial(work: () => Promise<void>) {
    const next = this.chain.then(async () => { if (!this.closed) await work(); });
    this.chain = next.catch(() => {});
    return next;
  }

  receive(kind: string, payload: any) {
    return this.serial(async () => {
      const key = JSON.stringify([kind, payload]);
      if (this.seen.has(key)) return;
      if (kind === 'ice') {
        if (!this.pc.remoteDescription) this.pending.push(payload);
        else await this.pc.addIceCandidate(payload);
      } else if (kind === 'offer' || kind === 'answer') {
        if (kind === 'answer' && this.pc.signalingState !== 'have-local-offer') return;
        await this.pc.setRemoteDescription(payload);
        for (const candidate of this.pending) await this.pc.addIceCandidate(candidate);
        this.pending = [];
      }
      this.seen.add(key);
    });
  }

  async offer() {
    await this.pc.setLocalDescription(await this.pc.createOffer());
    return this.pc.localDescription!.toJSON();
  }

  async answer(offer: RTCSessionDescriptionInit) {
    await this.receive('offer', offer);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    return this.pc.localDescription!.toJSON();
  }

  close() {
    this.closed = true;
    this.pc.onconnectionstatechange = null;
    this.pc.ontrack = null;
    this.pc.onicecandidate = null;
    this.pc.close();
    this.pending = [];
  }
}

export function getRtcConfiguration(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  // TURN credentials must be supplied by the deployment for restrictive mobile networks.
  const urls = import.meta.env.VITE_TURN_URLS;
  if (urls) iceServers.push({ urls: urls.split(',').map((url: string) => url.trim()),
    username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL });
  return { iceServers };
}

export function resolveRiderId(chatId: string, deviceId: string, contactId?: string): string | null {
  if (!chatId.startsWith('dm_')) return chatId === deviceId ? null : chatId;
  if (contactId && contactId !== deviceId) return contactId;
  const pair = chatId.slice(3);
  if (pair.startsWith(deviceId + '_')) return pair.slice(deviceId.length + 1) || null;
  if (pair.endsWith('_' + deviceId)) return pair.slice(0, -(deviceId.length + 1)) || null;
  return null;
}
