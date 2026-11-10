import React from 'react';
import { X, Map as MapIcon } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-white font-bold">
            <MapIcon className="w-5 h-5 text-orange-500" />
            <span>Kortej Canlı Konum</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden p-2">
          <LiveMap messages={messages} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
};
