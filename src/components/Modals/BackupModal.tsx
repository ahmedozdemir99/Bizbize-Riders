import React, { useRef } from 'react';
import { X, Cloud, Download, Upload } from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-white uppercase tracking-wide">
                YEDEKLEME & GERİ YÜKLE
              </h3>
              <p className="text-xs text-zinc-400">Kortejler ve mesaj ayarlarını yedekleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center biker-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Cihazda saklanan kortejleri, rehberinizi ve sohbet geçmişinizi JSON olarak yedekleyebilirsiniz. Geri yükleme mevcut mesajlarla birleştirir; sunucuya mesaj göndermez.
        </p>

        <div className="space-y-3 pt-2">
          <button
            onClick={onExport}
            className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 biker-btn shadow-lg active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Yedek İndir (.JSON)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-zinc-700 biker-btn active:scale-95"
          >
            <Upload className="w-4 h-4 text-orange-400" />
            <span>Yedeği Geri Yükle</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onImport}
            hidden
          />
        </div>
      </div>
    </div>
  );
};
