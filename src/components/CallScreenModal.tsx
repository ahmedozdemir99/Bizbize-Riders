import React, { useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Bike } from 'lucide-react';
import { CallType } from '../types';

interface CallScreenModalProps {
  isOpen: boolean;
  callType: CallType;
  title: string;
  statusText: string;
  isGroupCall?: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  groupRemoteStreams?: Record<string, { name: string; stream: MediaStream }>;
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
  onEndCall,
}) => {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);

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
    <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* 1-on-1 Video Stream */}
      {!isGroupCall && callType === 'video' && remoteStream && (
        <video
          ref={(node) => {
            if (node && node.srcObject !== remoteStream) {
              node.srcObject = remoteStream;
            }
          }}
          autoPlay
          playsInline
          className="w-full h-full object-cover bg-zinc-950"
        />
      )}

      {/* Group Call Remote Video Grid */}
      {isGroupCall && (
        <div className="absolute inset-0 p-4 pt-24 pb-28 grid grid-cols-2 gap-3 overflow-y-auto content-center">
          {Object.entries(groupRemoteStreams).map(([id, info]) => (
            <div
              key={id}
              className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 min-h-[140px] shadow-lg flex items-center justify-center"
            >
              <video
                ref={(node) => {
                  if (node && node.srcObject !== info.stream) {
                    node.srcObject = info.stream;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full min-h-[140px] object-cover"
              />
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
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-orange-600 to-orange-500 flex items-center justify-center text-5xl text-white shadow-2xl border border-white/20 animate-pulse">
            <Bike className="w-14 h-14" />
          </div>
          <div className="font-display text-3xl font-bold text-white tracking-wide uppercase">
            {title || 'Sürücü'}
          </div>
          <div className="text-sm font-semibold text-emerald-400 bg-emerald-950/60 px-4 py-1 rounded-full border border-emerald-500/30">
            {statusText}
          </div>
        </div>
      )}

      {/* Local PIP Video */}
      {callType === 'video' && localStream && (
        <div className="absolute right-4 top-4 w-28 h-40 object-cover rounded-2xl border-2 border-orange-500/60 shadow-2xl bg-zinc-900 overflow-hidden z-20">
          <video
            ref={(node) => {
              if (node && node.srcObject !== localStream) {
                node.srcObject = localStream;
              }
            }}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Control Buttons Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-30 bg-zinc-900/90 backdrop-blur-md px-6 py-3 rounded-full border border-zinc-800 shadow-2xl">
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
