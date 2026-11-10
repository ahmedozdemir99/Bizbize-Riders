import React from 'react';
import { X, MessageSquare, Phone, Video, UserPlus, RefreshCw, Users, Trash2 } from 'lucide-react';
import { UserProfile } from '../../types';

interface RidersDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  riders: UserProfile[];
  activeChatId: string | null;
  onOpenDmChat: (id: string, name: string) => void;
  onStartCall: (target: { id: string; name: string }, type: 'audio' | 'video') => void;
  onHideRider: (id: string, name: string) => void;
  onRestoreHidden: () => void;
  onAddRiderToGroup?: (userId: string, userName: string) => void;
}

export const RidersDirectoryModal: React.FC<RidersDirectoryModalProps> = ({
  isOpen,
  onClose,
  riders,
  activeChatId,
  onOpenDmChat,
  onStartCall,
  onHideRider,
  onRestoreHidden,
  onAddRiderToGroup,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-white uppercase tracking-wide">
                RIDERS DİZİNİ
              </h3>
              <p className="text-xs text-zinc-400">Tüm aktif ve kayıtlı sürücüler</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center biker-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Restore Hidden Riders Button */}
        <button
          onClick={onRestoreHidden}
          className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center justify-center gap-2 biker-btn transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
          <span>Gizlenen Rider Kayıtlarını Geri Getir</span>
        </button>

        {/* Riders List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[200px]">
          {riders.map((u) => {
            const isFresh = u.updated_at && Date.now() - new Date(u.updated_at).getTime() < 70000;
            const isOnline = !!u.online && !!isFresh;

            return (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white text-lg shrink-0 shadow-md">
                    {u.avatar || '🏍️'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate text-sm">{u.name || 'Sürücü'}</div>
                    <div className={`text-[10px] font-semibold ${isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {isOnline ? '● Çevrimiçi' : '○ Çevrimdışı'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      onOpenDmChat(u.id, u.name || 'Rider');
                      onClose();
                    }}
                    className="p-2 bg-sky-700 hover:bg-sky-600 text-white rounded-xl text-xs font-bold biker-btn"
                    title="Mesaj"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onStartCall({ id: u.id, name: u.name || 'Rider' }, 'audio')}
                    className="p-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs biker-btn"
                    title="Sesli Ara"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onStartCall({ id: u.id, name: u.name || 'Rider' }, 'video')}
                    className="p-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs biker-btn"
                    title="Görüntülü Ara"
                  >
                    <Video className="w-3.5 h-3.5" />
                  </button>

                  {activeChatId && !activeChatId.startsWith('dm_') && activeChatId !== 'global' && onAddRiderToGroup && (
                    <button
                      onClick={() => onAddRiderToGroup(u.id, u.name || 'Rider')}
                      className="p-2 bg-orange-700 hover:bg-orange-600 text-white rounded-xl text-xs biker-btn"
                      title="Gruba Ekle"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => onHideRider(u.id, u.name || 'Rider')}
                    className="p-2 bg-red-950 hover:bg-red-900 text-red-400 border border-red-900/40 rounded-xl text-xs biker-btn"
                    title="Sürücüyü Sil / Kaldır"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {riders.length === 0 && (
            <div className="text-center text-zinc-500 text-xs py-10">
              Şu anda başka kayıtlı Rider bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
