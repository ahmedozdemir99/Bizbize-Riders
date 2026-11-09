import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { CallRecord } from '../../types';

interface IncomingCallModalProps {
  call: CallRecord | null;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ call, onAccept, onReject }) => {
  if (!call) return null;

  return (
    <div className="fixed inset-0 z-[350] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl space-y-5 animate-bounce-short">
        <div className="w-16 h-16 rounded-3xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto animate-pulse">
          {call.type === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
        </div>

        <div>
          <div className="text-emerald-400 font-bold uppercase tracking-widest text-xs">
            Gelen {call.type === 'video' ? 'Görüntülü' : 'Sesli'} Arama
          </div>
          <h3 className="font-display font-bold text-2xl text-white tracking-wide mt-1">
            {call.caller_name || 'Sürücü'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">Sizinle bağlantı kurmak istiyor...</p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onAccept}
            className="py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg biker-btn active:scale-95"
          >
            <Phone className="w-4 h-4 fill-current" />
            <span>Kabul Et</span>
          </button>

          <button
            onClick={onReject}
            className="py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg biker-btn active:scale-95"
          >
            <PhoneOff className="w-4 h-4 fill-current" />
            <span>Reddet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
