import React from 'react';
import { X, Phone, Video, Trash2, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import { CallRecord } from '../../types';

interface CallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  calls: CallRecord[];
  currentUserId: string;
  onDeleteCall: (id: string) => void;
  onClearAll: () => void;
}

export const CallHistoryModal: React.FC<CallHistoryModalProps> = ({
  isOpen,
  onClose,
  calls,
  currentUserId,
  onDeleteCall,
  onClearAll,
}) => {
  if (!isOpen) return null;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ringing': return 'Çalıyor';
      case 'connected': return 'Bağlandı';
      case 'rejected': return 'Reddedildi';
      case 'ended': return 'Tamamlandı';
      case 'missed': return 'Cevapsız';
      default: return status;
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-white uppercase tracking-wide">
                ARAMA GEÇMİŞİ
              </h3>
              <p className="text-xs text-zinc-400">Gelen ve giden tüm aramalar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center biker-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clear All Button */}
        {calls.length > 0 && (
          <button
            onClick={onClearAll}
            className="w-full py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 text-xs font-bold flex items-center justify-center gap-2 biker-btn transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Tüm Arama Geçmişini Sil</span>
          </button>
        )}

        {/* Call Logs List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[200px]">
          {calls.map((c) => {
            const isOutgoing = c.caller_id === currentUserId;
            const personName = isOutgoing ? c.callee_name || 'Rider' : c.caller_name || 'Rider';

            let formattedDate = '';
            try {
              formattedDate = new Date(c.created_at).toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
            } catch {}

            return (
              <div
                key={c.id}
                className="flex items-center justify-between p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800/80 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                      isOutgoing ? 'bg-orange-600/30 text-orange-400 border border-orange-500/40' : 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    {isOutgoing ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                      <span>{personName}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      {c.type === 'video' ? <Video className="w-3.5 h-3.5 text-sky-400" /> : <Phone className="w-3.5 h-3.5 text-emerald-400" />}
                      <span className={c.status === 'missed' ? 'text-red-400 font-bold' : ''}>
                        {getStatusLabel(c.status)}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-zinc-500">{formattedDate}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteCall(c.id)}
                  className="w-9 h-9 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 shrink-0 flex items-center justify-center biker-btn transition"
                  title="Kaydı Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {calls.length === 0 && (
            <div className="text-center text-zinc-500 text-xs py-10">
              Arama geçmişi boş.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
