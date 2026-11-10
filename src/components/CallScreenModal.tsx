import React, { useState, useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { CallType } from '../types';
import { MotorcycleIcon } from './MotorcycleIcon';

// Mobile browsers may block unmuted autoplay even after a call was accepted.
function RemoteMedia({ stream, audioOnly = false }: { stream: MediaStream; audioOnly?: boolean }) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const play = () => {
    const media = ref.current;
    if (!media) return;
    void media.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  };
  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    media.srcObject = stream;
    play();
    return () => { media.pause(); media.srcObject = null; };
  }, [stream]);
  return <>
    {audioOnly ? <audio ref={node => { ref.current = node; }} autoPlay aria-label="Karşı tarafın sesi" />
      : <video ref={node => { ref.current = node; }} autoPlay playsInline className="w-full h-full object-cover bg-zinc-950" />}
    {blocked && <button onClick={play} className="absolute top-24 left-4 z-40 rounded-xl bg-orange-600 p-3 text-white font-bold">
      Sesi ve görüntüyü aç
    </button>}
  </>;
}

interface CallScreenModalProps {
  isOpen: boolean;
  callType: CallType;
  title: string;
  statusText: string;
  isGroupCall?: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  groupRemoteStreams?: Record<string, { name: string; stream: MediaStream }>;
  peerConnection?: RTCPeerConnection | null;
  connectedAt?: number | null;
  onEndCall: () => void;
}

export const CallScreenModal: React.FC<CallScreenModalProps> = ({
  isOpen,
  callType,
  title,
  statusText,
  isGroupCall,
  localStream,
  remoteStream,
  groupRemoteStreams = {},
  peerConnection = null,
  connectedAt = null,
  onEndCall,
}) => {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isOpen || !connectedAt) { setElapsed(0); return; }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
    update(); const timer = window.setInterval(update, 1000); return () => clearInterval(timer);
  }, [isOpen, connectedAt]);
  const [packetLoss, setPacketLoss] = useState<number>(0);
  const [jitter, setJitter] = useState<number>(0);
  const [rtt, setRtt] = useState<number>(0);

  React.useEffect(() => {
    if (!isOpen || !peerConnection) return;
    let previous = { lost: 0, received: 0 };
    setPacketLoss(0); setJitter(0); setRtt(0);
    const interval = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats();
        let pktsLost = 0;
        let pktsReceived = 0;
        let jit = 0;
        let roundTrip = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp') {
            if (typeof report.packetsLost === 'number') pktsLost += Math.max(0, report.packetsLost);
            if (typeof report.packetsReceived === 'number') pktsReceived += report.packetsReceived;
            if (typeof report.jitter === 'number') jit = Math.max(jit, report.jitter * 1000); // convert to ms
          }
          if (report.type === 'remote-inbound-rtp' && typeof report.roundTripTime === 'number') {
            roundTrip = report.roundTripTime * 1000;
          }
        });

        const lost = Math.max(0, pktsLost - previous.lost), received = Math.max(0, pktsReceived - previous.received);
        const total = lost + received;
        const lossPercent = total > 0 ? (lost / total) * 100 : 0;
        previous = { lost: pktsLost, received: pktsReceived };
        setPacketLoss(Number(lossPercent.toFixed(1)));
        setJitter(Number(jit.toFixed(1)));
        setRtt(Number(roundTrip.toFixed(0)));
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, peerConnection]);

  useEffect(() => {
    setIsMicMuted(false);
    setIsVideoDisabled(false);
  }, [localStream]);

  if (!isOpen) return null;

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(!isMicMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoDisabled(!isVideoDisabled);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] bg-black flex flex-col items-center justify-center overflow-hidden">
      {!isGroupCall && remoteStream && <RemoteMedia stream={remoteStream} audioOnly={callType === 'audio'} />}

      {/* Group Call Remote Video Grid */}
      {isGroupCall && (
        <div className="absolute inset-0 p-4 pt-24 pb-28 grid grid-cols-2 gap-3 overflow-y-auto content-center">
          {Object.entries(groupRemoteStreams).map(([id, info]) => (
            <div
              key={id}
              className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 min-h-[140px] shadow-lg flex items-center justify-center"
            >
              <RemoteMedia stream={info.stream} audioOnly={callType === 'audio'} />
              <div className="absolute bottom-2 left-2 right-2 text-xs font-bold text-white bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 truncate">
                {info.name || 'Rider'}
              </div>
            </div>
          ))}
          {Object.keys(groupRemoteStreams).length === 0 && (
            <div className="col-span-2 text-center text-zinc-400 text-sm py-12 bg-zinc-900/60 rounded-2xl border border-zinc-800">
              Diğer katılan Rider’lar bekleniyor...
            </div>
          )}
        </div>
      )}

      {/* Audio Backdrop Icon */}
      {(callType === 'audio' || (!remoteStream && !isGroupCall)) && (
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black z-10">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center p-4 text-white shadow-2xl border border-white/20 animate-pulse">
            <MotorcycleIcon className="w-full h-full text-white" />
          </div>
          <div className="font-display text-3xl font-bold text-white tracking-wide uppercase">
            {title || 'Sürücü'}
          </div>
          <div className="text-sm font-semibold text-emerald-400 bg-emerald-950/60 px-4 py-1 rounded-full border border-emerald-500/30">
            {statusText}
          </div>
        </div>
      )}

      <div className="call-status absolute left-4 top-4 z-30 max-w-[55%] rounded-xl bg-black/75 px-3 py-2 text-white text-xs" role="status">
        <p>{statusText}</p>
        {connectedAt && <p className="font-mono mt-1">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</p>}
        {connectedAt && peerConnection && <p className="mt-1 text-zinc-300" title={`Paket kaybı %${packetLoss}, gecikme ${rtt} ms, titreşim ${jitter} ms`}>
          {packetLoss > 5 || rtt > 400 || jitter > 50 ? 'Bağlantı zayıf' : 'Bağlantı iyi'}
        </p>}
      </div>

      {/* Local PIP Video (Selfie / Front-Camera Preview with clear indicator) */}
      {callType === 'video' && localStream && (
        <div className="call-preview absolute right-4 top-4 w-28 h-40 rounded-2xl border-2 border-orange-500 shadow-2xl bg-zinc-900 overflow-hidden z-20 group">
          <video
            ref={(node) => {
              if (node && node.srcObject !== localStream) {
                node.srcObject = localStream;
              }
            }}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover -scale-x-100"
          />
          <div className="absolute bottom-1 inset-x-1 bg-black/85 backdrop-blur-sm rounded-lg px-1.5 py-0.5 text-[9px] font-bold text-white text-center flex items-center justify-center gap-1 border border-white/10 shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Siz (Ön Kamera)</span>
          </div>
        </div>
      )}

      {/* Control Buttons Bar */}
      <div className="call-controls absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-30 bg-zinc-900/90 backdrop-blur-md px-6 py-3 rounded-full border border-zinc-800 shadow-2xl">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition active:scale-95 ${
            isMicMuted ? 'bg-red-600' : 'bg-zinc-800 hover:bg-zinc-700'
          }`}
          title={isMicMuted ? 'Sesi Aç' : 'Sesi Kapat'}
        >
          {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {callType === 'video' && (
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition active:scale-95 ${
              isVideoDisabled ? 'bg-red-600' : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
            title={isVideoDisabled ? 'Kamerayı Aç' : 'Kamerayı Kapat'}
          >
            {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        <button
          onClick={onEndCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg biker-btn active:scale-95"
          title="Aramayı Sonlandır"
        >
          <PhoneOff className="w-6 h-6 fill-current" />
        </button>
      </div>
    </div>
  );
};
