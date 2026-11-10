import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Volume2, Sparkles, Radio } from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeChatId: string | null;
  activeChatName: string;
  onSendMessage: (text: string) => void;
  onOpenGroupMap: () => void;
  onOpenRoadAlert: () => void;
  onOpenRiders: () => void;
  onBackToChatList: () => void;
  onToggleSound: () => void;
  soundEnabled: boolean;
  onStartCall: (type: 'audio' | 'video') => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  activeChatId,
  activeChatName,
  onSendMessage,
  onOpenGroupMap,
  onOpenRoadAlert,
  onOpenRiders,
  onBackToChatList,
  onToggleSound,
  soundEnabled,
  onStartCall,
}) => {
  const [isListening, setIsListening] = useState(false);
  // Default continuous helmet mode to FALSE so mic does not stay open unintentionally
  const [continuousMode, setContinuousMode] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isStoppingRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const continuousModeRef = useRef(continuousMode);
  continuousModeRef.current = continuousMode;

  // Text to Speech Voice Feedback (Turkish)
  const speakFeedback = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'tr-TR';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('TTS error:', e);
      }
    }
  };

  const processCommand = (rawText: string) => {
    const text = rawText.toLowerCase().trim();
    setTranscript(rawText);

    // Strip optional wake word "hey bizbize" or "bizbize"
    const cleaned = text
      .replace(/^hey\s+bizbize[,.]?\s*/i, '')
      .replace(/^bizbize[,.]?\s*/i, '')
      .trim();

    // 1. Message sending: "mesaj gönder [text]" or "yaz [text]"
    if (cleaned.startsWith('mesaj gönder') || cleaned.startsWith('mesaj yaz') || cleaned.startsWith('yaz ')) {
      let msg = cleaned
        .replace(/^mesaj\s+gönder\s*/i, '')
        .replace(/^mesaj\s+yaz\s*/i, '')
        .replace(/^yaz\s*/i, '')
        .trim();

      if (msg) {
        msg = msg.charAt(0).toUpperCase() + msg.slice(1);
        if (activeChatId) {
          onSendMessage(msg);
          setLastAction(`Mesaj gönderildi: "${msg}"`);
          speakFeedback(`Mesajınız iletildi.`);
        } else {
          setLastAction(`Lütfen önce bir sohbete girin.`);
          speakFeedback(`Mesaj göndermek için bir sohbet açmalısınız.`);
        }
        return;
      }
    }

    // 2. Open group map: "kortej haritasını aç", "harita", "haritayı aç"
    if (cleaned.includes('harita') || cleaned.includes('haritayı aç') || cleaned.includes('kortej haritası')) {
      if (activeChatId && !activeChatId.startsWith('dm_')) {
        onOpenGroupMap();
        setLastAction('Kortej canlı haritası açıldı.');
        speakFeedback('Kortej haritası açılıyor.');
        handleSafeClose();
      } else {
        setLastAction('Kortej haritası yalnızca grup sohbetinde açılabilir.');
        speakFeedback('Harita için bir kortej grubunda olmalısınız.');
      }
      return;
    }

    // 3. Road Alert: "yol ikazı", "radar bildir", "tehlike", "ikaz ver"
    if (cleaned.includes('ikaz') || cleaned.includes('radar') || cleaned.includes('tehlike')) {
      onOpenRoadAlert();
      setLastAction('Yol ikazı menüsü açıldı.');
      speakFeedback('Yol ikazı açılıyor.');
      handleSafeClose();
      return;
    }

    // 4. Riders Directory: "sürücüler", "riders", "rehber"
    if (cleaned.includes('sürücü') || cleaned.includes('rider') || cleaned.includes('rehber')) {
      onOpenRiders();
      setLastAction('Riders dizini açıldı.');
      speakFeedback('Sürücüler listesi açılıyor.');
      handleSafeClose();
      return;
    }

    // 5. Sound Toggle: "sesi aç", "sesi kapat", "ses efektleri"
    if (cleaned.includes('sesi aç') || cleaned.includes('sesi kapat') || cleaned.includes('ses efekt')) {
      onToggleSound();
      const statusStr = !soundEnabled ? 'açıldı' : 'kapatıldı';
      setLastAction(`Ses efektleri ${statusStr}.`);
      speakFeedback(`Ses ${statusStr}.`);
      return;
    }

    // 6. Voice Call: "sesli ara", "arama yap", "ara"
    if (cleaned.includes('sesli ara') || cleaned.includes('arama yap')) {
      if (activeChatId) {
        onStartCall('audio');
        setLastAction('Sesli arama başlatılıyor.');
        speakFeedback('Sesli arama başlatılıyor.');
        handleSafeClose();
      } else {
        setLastAction('Arama başlatmak için bir sohbet seçin.');
        speakFeedback('Arama için bir kişi veya grup seçmelisiniz.');
      }
      return;
    }

    // 7. Navigation: "geri dön", "sohbetten çık", "ana menü"
    if (cleaned.includes('geri') || cleaned.includes('sohbetten çık') || cleaned.includes('ana menü') || cleaned.includes('kapat')) {
      if (activeChatId) {
        onBackToChatList();
        setLastAction('Sohbet listesine dönüldü.');
        speakFeedback('Ana listeye dönüldü.');
        handleSafeClose();
      } else {
        handleSafeClose();
      }
      return;
    }

    // 8. Emergency alert: "acil durum", "yardım çağır", "imdat"
    if (cleaned.includes('acil durum') || cleaned.includes('yardım') || cleaned.includes('kaza')) {
      if (activeChatId) {
        onSendMessage('🚨 ACİL DURUM YARDIM ÇAĞRISI! Konumuma acil destek gerekebilir.');
        setLastAction('Acil durum mesajı gruba gönderildi!');
        speakFeedback('Acil durum mesajınız korteje iletildi.');
      } else {
        speakFeedback('Acil durum için lütfen bir grup açın.');
      }
      return;
    }

    // Unknown command
    setLastAction(`Komut anlaşılamadı: "${rawText}"`);
  };

  const startListening = () => {
    setErrorMsg(null);
    isStoppingRef.current = false;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorMsg('Tarayıcınız Web Speech API ses tanıma özelliğini desteklemiyor.');
      return;
    }

    try {
      stopListening();

      const rec = new SpeechRec();
      rec.lang = 'tr-TR';
      rec.continuous = continuousModeRef.current;
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
      };

      rec.onresult = (event: any) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        if (text) {
          processCommand(text);
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        if (event.error === 'not-allowed') {
          setErrorMsg('Mikrofon erişim izni verilmedi.');
          stopListening();
          return;
        }
      };

      rec.onend = () => {
        // Only restart if explicitly in continuous helmet mode AND modal is open AND not stopping!
        if (!isStoppingRef.current && isOpenRef.current && continuousModeRef.current) {
          try {
            rec.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      rec.start();
      recognitionRef.current = rec;
      speakFeedback('Sesli komut dinleniyor.');
    } catch (e: any) {
      setErrorMsg('Ses tanıma başlatılamadı: ' + (e.message || ''));
      setIsListening(false);
    }
  };

  const stopListening = () => {
    isStoppingRef.current = true;
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      // CRITICAL: Clear listeners before abort to prevent automatic restart loop
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      rec.onstart = null;
      try {
        rec.abort();
      } catch {}
    }
    setIsListening(false);
  };

  const handleSafeClose = () => {
    stopListening();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    onClose();
  };

  // Lifecycle control: stop listening when closed or unmounted
  useEffect(() => {
    if (isOpen) {
      // When opened, start listening once
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/85 z-[600] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleSafeClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-500 flex items-center justify-center">
              <Radio className={`w-4 h-4 ${isListening ? 'animate-pulse text-orange-400' : ''}`} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white uppercase tracking-wider">
                Kask İçi Sesli Asistan
              </h3>
              <p className="text-[10px] text-zinc-400">Eller Serbest (Hands-Free) Kontrol</p>
            </div>
          </div>
          <button 
            onClick={handleSafeClose} 
            className="w-8 h-8 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Listening Wave Indicator */}
        <div className="flex flex-col items-center justify-center py-4 bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
          <button
            onClick={() => {
              if (isListening) stopListening();
              else startListening();
            }}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition shadow-2xl relative ${
              isListening
                ? 'bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-orange-500/40'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {isListening && (
              <span className="absolute inset-0 rounded-full border-2 border-orange-500 animate-ping opacity-75" />
            )}
            {isListening ? <Mic className="w-9 h-9" /> : <MicOff className="w-9 h-9" />}
          </button>

          <span className="mt-3 text-xs font-mono font-bold uppercase tracking-wider text-orange-400">
            {isListening ? '🎙️ Sizi Dinliyor...' : 'Dokunarak Başlatın'}
          </span>

          {transcript && (
            <div className="mt-2 px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800 max-w-[90%] text-center">
              <span className="text-[11px] text-zinc-400 italic">"{transcript}"</span>
            </div>
          )}

          {lastAction && (
            <div className="mt-2 px-3 py-1 bg-emerald-950/40 border border-emerald-500/40 rounded-lg max-w-[90%] text-center">
              <span className="text-[11px] text-emerald-400 font-semibold">{lastAction}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-2 px-3 py-1 bg-red-950/40 border border-red-500/40 rounded-lg max-w-[90%] text-center">
              <span className="text-[11px] text-red-400">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Continuous Mode Toggle */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/40 rounded-xl border border-zinc-800/60 text-xs">
          <div>
            <span className="text-zinc-300 font-medium block">Sürekli Dinleme (Kask Modu)</span>
            <span className="text-[10px] text-zinc-500">Açıkken komutları durmaksızın bekler</span>
          </div>
          <button
            onClick={() => {
              const nextMode = !continuousMode;
              setContinuousMode(nextMode);
              continuousModeRef.current = nextMode;
              if (isListening) {
                startListening();
              }
            }}
            className={`w-10 h-6 rounded-full p-1 transition ${
              continuousMode ? 'bg-orange-600' : 'bg-zinc-700'
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition transform ${
              continuousMode ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Voice Commands Cheat Sheet */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-orange-500" /> Söyleyebileceğiniz Komutlar:
          </span>
          <div className="grid grid-cols-1 gap-1 text-[11px] text-zinc-300">
            <div className="bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-800/60 flex items-center justify-between">
              <span>"Hey BizBize, mesaj gönder [mesajınız]"</span>
              <span className="text-[9px] text-orange-400 font-mono">Mesaj</span>
            </div>
            <div className="bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-800/60 flex items-center justify-between">
              <span>"Kortej haritasını aç"</span>
              <span className="text-[9px] text-orange-400 font-mono">Harita</span>
            </div>
            <div className="bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-800/60 flex items-center justify-between">
              <span>"Yol ikazı ver" / "Radar bildir"</span>
              <span className="text-[9px] text-orange-400 font-mono">İkaz</span>
            </div>
            <div className="bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-800/60 flex items-center justify-between">
              <span>"Sürücüleri göster" / "Riders"</span>
              <span className="text-[9px] text-orange-400 font-mono">Rehber</span>
            </div>
            <div className="bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-800/60 flex items-center justify-between">
              <span>"Geri dön" / "Sohbetten çık"</span>
              <span className="text-[9px] text-orange-400 font-mono">Geri</span>
            </div>
            <div className="bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-800/60 flex items-center justify-between">
              <span>"Acil durum" / "Yardım"</span>
              <span className="text-[9px] text-red-400 font-mono">Acil</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
