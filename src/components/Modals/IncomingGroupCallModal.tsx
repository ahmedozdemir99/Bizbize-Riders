import React from 'react';
import { Users, Video, X } from 'lucide-react';
import { GroupCallRecord } from '../../types';

interface IncomingGroupCallModalProps {
  call: GroupCallRecord | null;
  onJoin: () => void;
  onDismiss: () => void;
}

export const IncomingGroupCallModal: React.FC<IncomingGroupCallModalProps> = ({ call, onJoin, onDismiss }) => {
  if (!call) return null;

  return (
    <div className="fixed inset-0 z-[350] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 mx-auto animate-pulse">
          <Users className="w-8 h-8" />
        </div>

        <div>
          <div className="text-sky-400 font-bold uppercase tracking-widest text-xs">
            Grup Kortej Görüşmesi
          </div>
          <h3 className="font-display font-bold text-2xl text-white tracking-wide mt-1">
            {call.title || 'Kortej Görüşmesi'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            <span className="text-orange-400 font-bold">{call.caller_name || call.host_name || 'Bir Rider'}</span> grup görüntülü görüşmesi başlattı.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onJoin}
            className="py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg biker-btn active:scale-95"
          >
            <Video className="w-4 h-4 fill-current" />
            <span>Katıl</span>
          </button>

          <button
            onClick={onDismiss}
            className="py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm flex items-center justify-center gap-2 biker-btn active:scale-95"
          >
            <X className="w-4 h-4" />
            <span>Şimdi Değil</span>
          </button>
        </div>
      </div>
    </div>
  );
};
