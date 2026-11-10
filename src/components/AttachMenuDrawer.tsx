import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import React, { useRef } from 'react';
import { 
  X, 
  Camera, 
  FileText, 
  MapPin, 
  Navigation, 
  Mic, 
  Square, 
  Send 
} from 'lucide-react';

interface AttachMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPickMedia: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPickDoc: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendFixedLocation: () => void;
  onToggleLiveLocation: () => void;
  isLiveLocationActive: boolean;
  onSendVoiceNote: (audioUrl: string) => void;
  onError: (msg: string) => void;
}

export const AttachMenuDrawer: React.FC<AttachMenuDrawerProps> = ({
  isOpen,
  onClose,
  onPickMedia,
  onPickDoc,
  onSendFixedLocation,
  onToggleLiveLocation,
  isLiveLocationActive,
  onSendVoiceNote,
  onError,
}) => {
  const { isRecording, seconds: recordingSeconds, start: startRecording, stop: stopRecording } =
    useVoiceRecorder(isOpen, onSendVoiceNote, onError);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  if (!isOpen) return null;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/75 backdrop-blur-sm flex items-end justify-center">
      <div className="w-full max-w-[480px] bg-zinc-950 border-t-2 border-orange-500/80 rounded-t-[32px] p-6 shadow-2xl relative animate-in slide-in-from-bottom duration-300">
        {/* Top Handle Bar */}
        <div className="flex flex-col items-center mb-5 cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1.5 bg-orange-500/40 rounded-full mb-1.5" />
          <span className="text-[10px] text-zinc-500 tracking-widest font-black uppercase">
            Kapat / Geri
          </span>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-6 text-orange-500/80 hover:text-orange-500 text-2xl biker-btn p-1"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Option Grid */}
        <div className="grid grid-cols-2 gap-3.5 max-w-md mx-auto mb-4">
          {/* Media Option */}
          <button
            onClick={() => mediaInputRef.current?.click()}
            className="bg-zinc-900 border border-orange-500/30 hover:border-orange-500 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 biker-btn tire-border transition"
          >
            <div className="w-13 h-13 rounded-full bg-orange-500/10 border-2 border-orange-500/70 flex items-center justify-center text-orange-500 text-2xl">
              <Camera className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-black tracking-wide text-zinc-300 uppercase">
              Galeri / Video
            </span>
          </button>

          {/* Document Option */}
          <button
            onClick={() => docInputRef.current?.click()}
            className="bg-zinc-900 border border-orange-500/30 hover:border-orange-500 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 biker-btn tire-border transition"
          >
            <div className="w-13 h-13 rounded-full bg-orange-500/10 border-2 border-orange-500/70 flex items-center justify-center text-orange-500 text-2xl">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-black tracking-wide text-zinc-300 uppercase">
              Belge
            </span>
          </button>

          {/* Fixed Location */}
          <button
            onClick={onSendFixedLocation}
            className="bg-zinc-900 border border-orange-500/30 hover:border-orange-500 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 biker-btn tire-border transition"
          >
            <div className="w-13 h-13 rounded-full bg-orange-500/10 border-2 border-orange-500/70 flex items-center justify-center text-orange-500 text-2xl">
              <MapPin className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-black tracking-wide text-zinc-300 uppercase">
              Sabit Konum
            </span>
          </button>

          {/* Live Location */}
          <button
            onClick={onToggleLiveLocation}
            className={`bg-zinc-900 border rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 biker-btn tire-border transition ${
              isLiveLocationActive
                ? 'border-emerald-500 bg-emerald-950/30'
                : 'border-orange-500/30 hover:border-orange-500'
            }`}
          >
            <div className={`w-13 h-13 rounded-full flex items-center justify-center text-2xl ${
              isLiveLocationActive
                ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 animate-pulse'
                : 'bg-orange-500/10 border-2 border-orange-500/70 text-orange-500'
            }`}>
              <Navigation className="w-6 h-6" />
            </div>
            <span className={`text-[11px] font-black tracking-wide uppercase ${
              isLiveLocationActive ? 'text-emerald-400' : 'text-zinc-300'
            }`}>
              {isLiveLocationActive ? 'Canlı Konum Açık' : 'Canlı Konum'}
            </span>
          </button>
        </div>

        {/* Audio Recording Button */}
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="w-full bg-zinc-900 border border-orange-500/40 hover:border-orange-500 rounded-2xl p-4 flex items-center justify-center space-x-3 biker-btn tire-border transition max-w-md mx-auto"
          >
            <div className="w-11 h-11 rounded-full bg-orange-500/10 border-2 border-orange-500/70 flex items-center justify-center text-orange-500 text-xl">
              <Mic className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-widest text-zinc-200 uppercase">
              SES KAYDI BAŞLAT
            </span>
          </button>
        ) : (
          <div className="w-full bg-red-950/80 border-2 border-red-600 rounded-2xl p-4 flex items-center justify-between shadow-lg max-w-md mx-auto animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-ping" />
              <span className="text-sm font-mono font-bold text-white">
                Kayıt Yapılıyor: {formatTimer(recordingSeconds)}
              </span>
            </div>

            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Bitir & Gönder</span>
            </button>
          </div>
        )}

        {/* Hidden File Inputs */}
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={onPickMedia}
          hidden
        />
        <input
          ref={docInputRef}
          type="file"
          accept="*/*"
          onChange={onPickDoc}
          hidden
        />
      </div>
    </div>
  );
};
