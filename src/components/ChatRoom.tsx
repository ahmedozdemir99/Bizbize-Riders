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
  AlertTriangle,
  ExternalLink,
  Navigation,
  X,
  Mic,
  Square,
  Zap
} from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { Message, MessageType, LocationData } from '../types';
import { MapPicker } from './MapPicker';
import { AudioPlayer } from './AudioPlayer';
import { LiveMap } from './LiveMap';
import { SpeedometerWidget } from './SpeedometerWidget';

interface ChatRoomProps {
  onError: (message: string) => void;
  chatName: string;
  chatAvatar: string;
  isDm: boolean;
  messages: Message[];
  currentUserId: string;
  onBack: () => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onClearMessages: () => void;
  onSendMessage: (
    type: MessageType, 
    content: string, 
    filename?: string, 
    replyToId?: string, 
    replyPreview?: { sender_name: string; text?: string | null }
  ) => void;
  onToggleAttachMenu: () => void;
  onOpenMediaViewer: (url: string, type: 'image' | 'video', filename?: string | null) => void;
  onUpdateMessage: (messageId: string, reactions: string[]) => void;
  onShowGroupMap: () => void;
  onOpenRoadAlert: () => void;
  onDeleteMessage?: (messageId: string) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  onError,
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
  onUpdateMessage,
  onShowGroupMap,
  onOpenRoadAlert,
  onDeleteMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const newestMessageRef = useRef('');

  const handleScrollToMessage = (targetMsgId: string) => {
    const el = document.getElementById(`chat-msg-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetMsgId);
      setTimeout(() => {
        setHighlightedMsgId(null);
      }, 2000);
    }
  };

  // Polling or reactions must not pull a rider away from the history they are reading.
  useEffect(() => {
    const last = messages.at(-1);
    const identity = last ? `${last.sender_id}_${last.time}` : '';
    if (scrollRef.current && (nearBottomRef.current ||
      (identity !== newestMessageRef.current && last?.sender_id === currentUserId))) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    newestMessageRef.current = identity;
  }, [messages, currentUserId]);

  const handleSendText = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    const replyPreview = replyToMessage ? {
      sender_name: replyToMessage.sender_name,
      text: replyToMessage.text || (replyToMessage.type === 'image' ? '📷 Görsel' : replyToMessage.type === 'location' ? '📍 Konum' : '📎 Ek')
    } : undefined;
    onSendMessage(
      'text', 
      text, 
      undefined, 
      replyToMessage?.id ? String(replyToMessage.id) : undefined,
      replyPreview
    );
    setReplyToMessage(null);
  };

  // Direct Voice Intercom Note Recording
  const { isRecording: isRecordingVoice, seconds: voiceSeconds, start: startVoiceRecording, stop: stopVoiceRecording } =
    useVoiceRecorder(true, url => onSendMessage('audio', url, 'Sesli Telsiz Mesajı'), onError);

  const BIKER_SIGNALS = [
    { label: 'Yakıt', icon: '⛽', text: '⛽ Yakıt İhtiyacı! En yakın benzinlikte duralım.' },
    { label: 'Mola', icon: '☕', text: '☕ Mola Verelim! Uygun bir yerde kahve molası.' },
    { label: 'Kaygan Yol', icon: '⚠️', text: '⚠️ Dikkat! Yol kaygan / virajda toz-kum var.' },
    { label: 'Kortej Durun', icon: '🛑', text: '🛑 Kortej Durun! Güvenli bir alana çekilin.' },
    { label: 'Yol Temiz', icon: '👍', text: '👍 Her şey yolunda, tempoyu koruyoruz.' },
    { label: 'Acil Yardım', icon: '🚨', text: '🚨 Acil Durum / Motor Arızası! Destek lazım.' },
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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
          {!isDm && (
            <button
              onClick={onShowGroupMap}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-600 text-white hover:bg-orange-500 flex items-center justify-center biker-btn shadow-sm"
              title="Korteji Haritada Göster"
            >
              <MapPin className="w-4 h-4" />
            </button>
          )}
          {!isDm && (
            <button
              onClick={onOpenRoadAlert}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-800 text-amber-400 hover:border-amber-500 border border-zinc-700 flex items-center justify-center biker-btn shadow-sm"
              title="Yol İkazı Gönder"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>
          )}
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
            onClick={() => {
              if (window.confirm('Bu sohbetteki tüm mesajlar kalıcı olarak silinsin mi?')) {
                onClearMessages();
              }
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-red-400 hover:border-red-500/50 flex items-center justify-center biker-btn shadow-sm"
            title="Mesajları Temizle"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Cockpit Telemetry Bar (Docked under header - zero overlap with messages) */}
      <div className="shrink-0 bg-zinc-950/95 border-b border-zinc-800/80 px-3 py-2 z-20 backdrop-blur-md">
        <SpeedometerWidget 
          onSendRideSummary={(summary) => onSendMessage('text', summary)} 
        />
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Sohbet mesajları"
        onScroll={event => {
          const feed = event.currentTarget;
          nearBottomRef.current = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
        }}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0"
      >
        {messages.map((m, idx) => {
          const isMine = m.sender_id === currentUserId;

          return (
            <div
              id={m.id ? `chat-msg-${m.id}` : undefined}
              key={`msg-${m.group_id}-${m.sender_id}-${m.time}`}
              className={`max-w-[88%] p-3 overflow-wrap-anywhere rounded-2xl flex flex-col transition-all duration-300 ${
                highlightedMsgId && String(m.id) === String(highlightedMsgId)
                  ? 'ring-2 ring-orange-500 scale-[1.02] shadow-xl shadow-orange-500/20'
                  : ''
              } ${
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

              {/* Distinct Interactive Quoted Message Bubble (WhatsApp style with smooth jump-to) */}
              {(m.reply_preview || (m.reply_to_id && messages.find(msg => String(msg.id) === String(m.reply_to_id)))) && (() => {
                const quote = m.reply_preview || (() => {
                  const found = messages.find(msg => String(msg.id) === String(m.reply_to_id));
                  return found ? { sender_name: found.sender_name, text: found.text || (found.type === 'location' ? '📍 Sabit Konum' : found.type === 'image' ? '📷 Görsel' : '📎 Ek') } : null;
                })();
                if (!quote) return null;
                return (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (m.reply_to_id) {
                        handleScrollToMessage(m.reply_to_id);
                      }
                    }}
                    className="mb-2 p-2 rounded-xl bg-black/45 hover:bg-black/60 border-l-4 border-orange-500 text-xs shadow-inner cursor-pointer transition-all active:scale-[0.98] group/quote"
                    title="Alıntılanan mesaja gitmek için dokunun"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-orange-400 text-[11px] truncate flex items-center gap-1">
                        <span>↩</span> {quote.sender_name || 'Sürücü'}
                      </p>
                      {m.reply_to_id && (
                        <span className="text-[9px] text-zinc-500 group-hover/quote:text-orange-400 font-mono transition shrink-0">
                          Gör →
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-300 text-xs line-clamp-2 mt-0.5 whitespace-pre-wrap break-words opacity-90">
                      {quote.text || 'Ekli mesaj'}
                    </p>
                  </div>
                );
              })()}

              {/* Specialized Sürüş Özeti (Ride Summary) Telemetry Card */}
              {m.type === 'text' && m.text?.startsWith('🏍️ SÜRÜŞ ÖZETİ') ? (
                <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-neutral-900 border border-orange-500/50 rounded-2xl p-3 shadow-xl space-y-2 my-0.5 text-left">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">🏍️</span>
                      <h4 className="text-xs font-black uppercase text-orange-400 tracking-wider">
                        Sürüş Özeti
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-orange-600/20 text-orange-400 text-[9px] font-mono font-bold uppercase border border-orange-500/30">
                      Telemetri
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                    {m.text.split('\n').slice(1).map((line, i) => {
                      if (!line.trim()) return null;
                      if (line.includes('🏁')) {
                        return (
                          <div key={i} className="col-span-2 text-[10px] text-emerald-400 italic pt-1 border-t border-zinc-800/80 font-sans">
                            {line}
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="bg-zinc-950/70 px-2.5 py-1.5 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-200">
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Regular Text Message */
                m.type === 'text' && (
                  <p className="text-[14.5px] font-medium leading-relaxed whitespace-pre-wrap break-words">
                    {m.text || ''}
                  </p>
                )
              )}

              {/* Live Location Message with Real Google Maps */}
              {m.type === 'location' && (() => {
                let loc: LocationData | null = null;
                try {
                  loc = JSON.parse(m.url || '{}');
                } catch {}

                if (loc?.live && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
                  return (
                    <div className="mt-2 space-y-2 w-full">
                      <div className="flex items-center justify-between px-1">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span>CANLI KONUM (GOOGLE HARİTALAR)</span>
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                        </span>
                      </div>

                      {/* Direct Google Maps View (No UI clutter covering map) */}
                      <MapPicker location={loc} isLive={true} />

                      {/* Optional Fullscreen Cortege Radar Shortcut */}
                      <button
                        onClick={onShowGroupMap}
                        className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center justify-center gap-2 transition biker-btn shadow-sm"
                      >
                        <span>🏍️ Kortej Radarı & Takip Asistanını Tam Ekran Aç</span>
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Static Location Message with Real Google Maps */}
              {m.type === 'location' && (() => {
                let loc: LocationData | null = null;
                try {
                  loc = JSON.parse(m.url || '{}');
                } catch {}

                if (!loc || loc.lat == null || loc.live) return null;

                return (
                  <div className="space-y-1.5 w-full mt-1">
                    <div className="flex items-center justify-between px-1">
                      <span className="flex items-center gap-1 text-xs font-bold text-orange-400">
                        <MapPin className="w-3.5 h-3.5 text-orange-500" />
                        <span>SABİT KONUM (GOOGLE HARİTALAR)</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      </span>
                    </div>

                    <MapPicker location={loc} isLive={false} />
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

              {/* Time and Status */}
              <div className="text-[10px] text-right opacity-60 mt-1.5 font-mono flex items-center justify-between">
                <div className="flex gap-1">
                  {['👍', '🔥', '🏍️'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        const current = m.reactions || [];
                        const next = current.includes(emoji)
                          ? current.filter(r => r !== emoji)
                          : [...current, emoji];
                        onUpdateMessage(m.id!, next);
                      }}
                      className="text-[12px] hover:bg-zinc-700/50 rounded-full px-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {formatTime(m.time || m.created_at)}
                  {m.sender_id === currentUserId && (
                    <span className={m.read_by && m.read_by.length > 0 ? 'text-sky-400' : 'text-zinc-500'}>
                      ✓✓
                    </span>
                  )}
                  <button
                    onClick={() => setReplyToMessage(m)}
                    className="text-[12px] hover:bg-zinc-700/50 rounded-full px-1.5 py-0.5 text-orange-500"
                    title="Yanıtla"
                  >
                    ↩️
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Bu mesaj kalıcı olarak silinsin mi?')) {
                        onDeleteMessage?.(String(m.id || `${m.sender_id}_${m.time}`));
                      }
                    }}
                    className="text-[11px] hover:bg-red-950/60 rounded-full px-1.5 py-0.5 text-zinc-500 hover:text-red-400 transition"
                    title="Mesajı Kalıcı Olarak Sil"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {m.reactions && m.reactions.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {Array.from(new Set(m.reactions)).map((r, i) => (
                    <span key={i} className="bg-zinc-950/50 rounded-full px-1.5 py-0.5 text-[10px]">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Message Composer Footer */}
      <div className="message-composer bg-zinc-950 border-t border-zinc-800 p-3 flex flex-col gap-2 shrink-0 z-30">
        {/* Reply Quote Preview */}
        {replyToMessage && (
            <div className="bg-zinc-900 border-l-4 border-orange-500 p-2 rounded-r-lg flex justify-between items-center">
                <div className="truncate text-xs text-zinc-300">
                    <span className="font-bold text-orange-500">{replyToMessage.sender_name}: </span>
                    {replyToMessage.text || 'Ekli mesaj'}
                </div>
                <button onClick={() => setReplyToMessage(null)} className="text-zinc-500 hover:text-white">
                    <X className="w-4 h-4" />
                </button>
            </div>
        )}

        {/* Biker Quick Action Glove Bar (One-Touch Emergency & Cortege Signals) */}
        {!isRecordingVoice && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1 shrink-0 pl-1">
              <Zap className="w-3 h-3 text-orange-500" /> Hızlı:
            </span>
            {BIKER_SIGNALS.map((sig) => (
              <button
                key={sig.label}
                onClick={() => onSendMessage('text', sig.text)}
                className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-orange-500 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1 shrink-0 active:scale-95 transition shadow-sm"
                title={sig.text}
              >
                <span>{sig.icon}</span>
                <span>{sig.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Composer Controls */}
        <div className="flex items-end gap-2.5">
          <button
            onClick={onToggleAttachMenu}
            disabled={isRecordingVoice}
            className="p-3 bg-zinc-900 rounded-xl text-zinc-400 border border-zinc-800 biker-btn transition hover:text-orange-500 hover:border-orange-500 active:scale-95 shrink-0 disabled:opacity-40"
            title="Medya / Konum / Ek Ekle"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          {isRecordingVoice ? (
            /* Live Voice Intercom Recording Bar */
            <div className="flex-1 bg-red-950/40 border border-red-500/50 rounded-2xl px-4 py-2 flex items-center justify-between min-h-[48px] animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-bold text-red-400">Sesli Telsiz Kaydediliyor...</span>
                <span className="text-xs font-mono font-bold text-white ml-2">{voiceSeconds}s</span>
              </div>
              <button
                onClick={stopVoiceRecording}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md active:scale-95"
              >
                <Square className="w-3 h-3 fill-current" /> Bitir & Gönder
              </button>
            </div>
          ) : (
            /* Standard Textarea */
            <div className="flex-1 biker-input rounded-2xl px-4 py-1.5 flex items-center min-h-[48px]">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={4000}
                placeholder="Mesaj yazın veya telsiz kaydı yapın..."
                className="text-sm font-medium w-full resize-none py-2 max-h-24 outline-none text-white placeholder-zinc-500 bg-transparent"
              />
            </div>
          )}

          {/* Send or Direct Voice Note Button */}
          {inputText.trim() ? (
            <button
              onClick={handleSendText}
              className="w-12 h-12 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center shrink-0 biker-btn shadow-lg shadow-orange-600/30 active:scale-95"
              title="Gönder"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : !isRecordingVoice ? (
            <button
              onClick={startVoiceRecording}
              className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-orange-500 hover:text-orange-500 text-zinc-300 flex items-center justify-center shrink-0 biker-btn shadow-md active:scale-95 transition"
              title="Sesli Telsiz Kaydı Başlat"
            >
              <Mic className="w-5 h-5 text-orange-500" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
