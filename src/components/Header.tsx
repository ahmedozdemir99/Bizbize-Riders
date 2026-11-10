import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Clock, 
  Cloud, 
  Users, 
  LogOut, 
  Database,
  Volume2,
  VolumeX,
  MoreVertical,
  X,
  Mic
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  statusText: string;
  isOnlineOk: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenPush: () => void;
  onOpenCallHistory: () => void;
  onOpenBackup: () => void;
  onOpenRiders: () => void;
  onOpenSqlModal: () => void;
  onOpenProfileSettings: () => void;
  onOpenVoiceAssistant: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  statusText,
  isOnlineOk,
  soundEnabled,
  onToggleSound,
  onOpenPush,
  onOpenCallHistory,
  onOpenBackup,
  onOpenRiders,
  onOpenSqlModal,
  onOpenProfileSettings,
  onOpenVoiceAssistant,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <header className="bg-zinc-900/95 border-b border-zinc-800 px-4 py-6 flex justify-between items-center shadow-lg sticky top-0 z-40 backdrop-blur-md min-w-0">
      {/* Left Branding */}
      <div 
        onClick={onOpenSqlModal}
        className="flex items-center gap-3 min-w-0 cursor-pointer group"
        title="Veritabanı Durumu & Ayarları"
      >
        <BrandLogo className="w-14 h-14 shrink-0" />
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl text-white tracking-wide uppercase leading-tight">
            BizBize <span className="text-orange-500 block">Riders</span>
          </h1>
          <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isOnlineOk ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <p className="text-[9px] font-bold uppercase text-zinc-500 truncate">
              {statusText}
            </p>
          </div>
        </div>
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-1 text-zinc-400 shrink-0 relative" ref={menuRef}>
        {/* Key Quick Buttons */}
        <button
          onClick={onOpenRiders}
          className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-400 flex items-center justify-center biker-btn transition"
          title="Riders Dizini"
        >
          <Users className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenCallHistory}
          className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sky-400 flex items-center justify-center biker-btn transition"
          title="Arama Geçmişi"
        >
          <Clock className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenVoiceAssistant}
          className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-orange-400 hover:border-orange-500/50 flex items-center justify-center biker-btn transition"
          title="Kask İçi Sesli Asistan (Web Speech)"
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleSound}
          className={`w-9 h-9 rounded-xl border flex items-center justify-center biker-btn transition ${
            soundEnabled
              ? 'bg-zinc-900 border-zinc-800 text-orange-400'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
          }`}
          title={soundEnabled ? 'Ses Efektleri Açık' : 'Ses Efektleri Kapalı'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* More Actions Toggle Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`w-9 h-9 rounded-xl border flex items-center justify-center biker-btn transition ${
            isMenuOpen
              ? 'bg-orange-600 border-orange-500 text-white'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
          }`}
          aria-label="Menü ve Ayarlar"
          aria-expanded={isMenuOpen}
          title="Menü ve Ayarlar"
        >
          {isMenuOpen ? <X className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
        </button>

        {/* Dropdown Menu Box */}
        {isMenuOpen && (
          <div className="absolute right-0 top-11 w-52 bg-zinc-900/95 border border-zinc-700/80 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-md space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
            <button
              onClick={() => {
                onOpenVoiceAssistant();
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-800/80 text-orange-400 font-semibold text-xs flex items-center gap-2.5 transition"
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span>Sesli Asistan (Kask Modu)</span>
            </button>

            <button
              onClick={() => {
                onOpenPush();
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-800/80 text-amber-400 font-semibold text-xs flex items-center gap-2.5 transition"
            >
              <Bell className="w-4 h-4 shrink-0" />
              <span>Bildirim Ayarları</span>
            </button>

            <button
              onClick={() => {
                onOpenBackup();
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-800/80 text-indigo-400 font-semibold text-xs flex items-center gap-2.5 transition"
            >
              <Cloud className="w-4 h-4 shrink-0" />
              <span>Yedekleme & Geri Yükle</span>
            </button>

            <button
              onClick={() => {
                onOpenSqlModal();
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-800/80 text-orange-400 font-semibold text-xs flex items-center gap-2.5 transition"
            >
              <Database className="w-4 h-4 shrink-0" />
              <span>Veritabanı Ayarları</span>
            </button>

            <button
              onClick={() => {
                onOpenProfileSettings();
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-800/80 text-sky-400 font-semibold text-xs flex items-center gap-2.5 transition"
            >
              <span className="w-4 h-4 flex items-center justify-center">👤</span>
              <span>Profil Ayarları</span>
            </button>

            <div className="border-t border-zinc-800/80 my-1" />

            <button
              onClick={() => {
                onLogout();
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-950/40 text-red-400 font-semibold text-xs flex items-center gap-2.5 transition"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
