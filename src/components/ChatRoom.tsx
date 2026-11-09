import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  Phone, 
  Video, 
  Trash2, 
  Paperclip, 
  Send,
  FileText,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { Message, MessageType, LocationData } from '../types';
import { MapPicker } from './MapPicker';
import { AudioPlayer } from './AudioPlayer';

interface ChatRoomProps {
  chatName: string;
  chatAvatar: string;
  isDm: boolean;
  messages: Message[];
  currentUserId: string;
  onBack: () => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onClearMessages: () => void;
  onSendMessage: (type: MessageType, content: string, filename?: string) => void;
  onToggleAttachMenu: () => void;
  onOpenMediaViewer: (url: string, type: 'image' | 'video', filename?: string | null) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chatName,
  chatAvatar,
  isDm,
  messages,
  currentUserId,
  onBack,
  onStartCall,
  onClearMessages,
  onSendMessage,
  onToggleAttachMenu,
  onOpenMediaViewer,
}) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendText = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    onSendMessage('text', text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const formatTime = (value?: number | string) => {
    if (!value) return '';
    let d: Date;
    if (typeof value === 'number' || /^\d+$/.test(String(value))) {
      d = new Date(Number(value));
    } else {
      d = new Date(value);
    }
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full relative min-h-0 carbon-bg">
      {/* Header */}
      <header className="bg-zinc-900/95 border-b border-zinc-800 p-3 flex justify-between items-center z-20 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg text-orange-500 hover:bg-zinc-800 flex items-center justify-center biker-btn"
            title="Geri"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white text-lg border border-zinc-700 shrink-0">
            {chatAvatar || '🏍️'}
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-bold text-lg text-white uppercase truncate">
              {chatName}
            </h2>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              {isDm ? 'Birebir Sohbet' : 'Kortej Sohbeti'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={() => onStartCall('audio')}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 hover:border-emerald-500/50 flex items-center justify-center biker-btn shadow-sm"
            title="Sesli Arama"
          >
            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={() => onStartCall('video')}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-sky-400 hover:border-sky-500/50 flex items-center justify-center biker-btn shadow-sm"
            title="Görüntülü Arama"
          >
            <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={onClearMessages}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-red-400 hover:border-red-500/50 flex items-center justify-center biker-btn shadow-sm"
            title="Mesajları Temizle"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0"
      >
        {messages.map((m, idx) => {
          const isMine = m.sender_id === currentUserId;

          return (
            <div
              key={m.id || idx}
              className={`max-w-[88%] p-3 overflow-wrap-anywhere rounded-2xl flex flex-col ${
                isMine
                  ? 'bg-zinc-800 text-zinc-100 rounded-br-xs self-end border border-zinc-700/80 shadow-md'
                  : 'bg-zinc-900 text-zinc-200 rounded-bl-xs self-start border border-zinc-800/80 shadow-md'
              }`}
            >
              {!isMine && (
                <div className="text-[11px] text-orange-500 font-bold mb-1">
                  {m.sender_name || 'Sürücü'}
                </div>
              )}

              {/* Text Message */}
              {m.type === 'text' && (
                <p className="text-[14.5px] font-medium leading-relaxed whitespace-pre-wrap break-words">
                  {m.text || ''}
                </p>
              )}

              {/* Location Message */}
              {m.type === 'location' && (() => {
                let loc: LocationData | null = null;
                try {
                  loc = JSON.parse(m.url || '{}');
                } catch {}

                if (!loc || loc.lat == null) {
                  return <p className="text-xs text-red-400">Konum verisi bozuk.</p>;
                }

                return (
                  <div className="space-y-2">
                    <MapPicker location={loc} isLive={loc.live} />
                  </div>
                );
              })()}

              {/* Audio Message */}
              {m.type === 'audio' && m.url && (
                <AudioPlayer src={m.url} />
              )}

              {/* Image Attachment */}
              {m.type === 'image' && m.url && (
                <div
                  onClick={() => onOpenMediaViewer(m.url!, 'image', m.filename)}
                  className="cursor-pointer group relative rounded-xl overflow-hidden border border-zinc-700/60 mt-1 max-h-60"
                >
                  <img
                    src={m.url}
                    alt={m.filename || 'Görsel'}
                    className="max-h-60 w-full object-cover rounded-xl transition group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-bold text-xs">
                    Büyütmek için Dokun
                  </div>
                </div>
              )}

              {/* Video Attachment */}
              {m.type === 'video' && m.url && (
                <div className="mt-1 rounded-xl overflow-hidden border border-zinc-700/60 max-h-60">
                  <video
                    src={m.url}
                    controls
                    playsInline
                    className="max-h-60 w-full object-cover rounded-xl"
                  />
                </div>
              )}

              {/* File Attachment */}
              {m.type === 'file' && m.url && (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2.5 bg-zinc-950/80 rounded-xl border border-zinc-700 hover:border-orange-500 transition text-xs font-semibold text-orange-400 break-all"
                >
                  <FileText className="w-5 h-5 shrink-0 text-orange-500" />
                  <span className="truncate flex-1">{m.filename || 'Ek Dosya'}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              )}

              {/* Time */}
              <div className="text-[10px] text-right opacity-60 mt-1.5 font-mono">
                {formatTime(m.time || m.created_at)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Message Composer Footer */}
      <div className="message-composer bg-zinc-950 border-t border-zinc-800 p-3 flex items-end gap-2.5 shrink-0 z-30">
        <button
          onClick={onToggleAttachMenu}
          className="p-3 bg-zinc-900 rounded-xl text-zinc-400 border border-zinc-800 biker-btn transition hover:text-orange-500 hover:border-orange-500 active:scale-95 shrink-0"
          title="Medya / Konum / Ek Ekle"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 biker-input rounded-2xl px-4 py-1.5 flex items-center min-h-[48px]">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={4000}
            placeholder="Mesaj yazın..."
            className="text-sm font-medium w-full resize-none py-2 max-h-24 outline-none text-white placeholder-zinc-500 bg-transparent"
          />
        </div>

        <button
          onClick={handleSendText}
          disabled={!inputText.trim()}
          className="w-12 h-12 rounded-2xl bg-orange-600 disabled:opacity-40 hover:bg-orange-500 text-white flex items-center justify-center shrink-0 biker-btn shadow-lg shadow-orange-600/30 active:scale-95"
          title="Gönder"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
