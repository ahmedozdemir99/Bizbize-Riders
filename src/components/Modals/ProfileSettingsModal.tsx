import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload } from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  currentName: string;
  currentAvatar: string | null;
  onSave: (name: string, avatar: string | null) => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  currentName,
  deviceId,
  currentAvatar,
  onSave,
}) => {
  const [name, setName] = useState(currentName);
  const [avatar, setAvatar] = useState<string | null>(currentAvatar);
  const [copyText, setCopyText] = useState('ID Kopyala');
  useEffect(() => { if (isOpen) { setName(currentName); setAvatar(currentAvatar); setCopyText('ID Kopyala'); } }, [isOpen, currentName, currentAvatar]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Profil Ayarları</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div 
            className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-4xl mb-4 overflow-hidden relative cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-zinc-500">👤</span>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <Camera className="w-8 h-8 text-white" />
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="text-orange-500 text-sm font-semibold flex items-center gap-1"
          >
            <Upload className="w-4 h-4" /> Fotoğraf Yükle
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-zinc-700 p-3">
          <label htmlFor="own-rider-id" className="text-xs text-zinc-400">Sürücü ID’niz — arkadaşınız rehberine eklemek için bunu kullanır</label>
          <input id="own-rider-id" value={deviceId} readOnly className="w-full bg-transparent text-xs text-white mt-2" onFocus={event => event.currentTarget.select()} />
          <button type="button" className="mt-2 text-orange-400 text-sm" onClick={async () => {
            try { await navigator.clipboard.writeText(deviceId); setCopyText('Kopyalandı'); }
            catch { document.getElementById('own-rider-id')?.focus(); setCopyText('ID’yi seçip kopyalayın'); }
          }}>{copyText}</button>
        </div>
        <div className="mb-6">
          <label className="block text-zinc-400 text-xs font-bold uppercase mb-2">Görünen İsim</label>
          <input
            type="text"
            minLength={2}
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none"
          />
        </div>

        <button
          disabled={name.trim().length < 2}
          onClick={() => {
            onSave(name.trim(), avatar);
            onClose();
          }}
          className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition"
        >
          Kaydet
        </button>
      </div>
    </div>
  );
};
