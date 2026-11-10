import React from 'react';
import { X, Map as MapIcon, ShieldCheck } from 'lucide-react';
import { LiveMap } from '../LiveMap';
import { Message } from '../../types';

interface GroupMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
}

export const GroupMapModal: React.FC<GroupMapModalProps> = ({
  isOpen,
  onClose,
  messages,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
          <div className="flex items-center gap-2 text-white font-bold">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-500">
              <MapIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">Kortej Canlı Harita</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Takip Asistanı Aktif
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono">
                Sürücüler arası hıza dayalı güvenli takip mesafesi
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-2 bg-zinc-950">
          <LiveMap messages={messages} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
};
