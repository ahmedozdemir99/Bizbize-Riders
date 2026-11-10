import React from 'react';
import { Search, Plus, Trash2, MessageSquare, Video, UserX, Users, Radio, UserPlus } from 'lucide-react';
import { CortegeGroup, DirectContact, UserProfile } from '../types';
import { WeatherWidget } from './WeatherWidget';

interface ChatListProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  groups: Record<string, { info: CortegeGroup }>;
  dmContacts: Record<string, DirectContact>;
  onlineRiders: UserProfile[];
  onOpenChat: (id: string, name: string, avatar: string) => void;
  onDeleteGroup: (id: string, name: string) => void;
  onDeleteDm: (id: string, name: string) => void;
  onStartCall: (target: { id: string; name: string }, type: 'audio' | 'video') => void;
  onHideRider: (id: string, name: string) => void;
  onOpenNewGroup: () => void;
  onOpenAddRider: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  searchQuery,
  onSearchChange,
  groups,
  dmContacts,
  onlineRiders,
  onOpenChat,
  onDeleteGroup,
  onDeleteDm,
  onStartCall,
  onHideRider,
  onOpenNewGroup,
  onOpenAddRider,
}) => {
  const query = searchQuery.trim().toLocaleLowerCase('tr-TR');

  const filteredGroups = Object.entries(groups).filter(([, g]) =>
    (g.info?.name || '').toLocaleLowerCase('tr-TR').includes(query)
  );

  const filteredDms = Object.entries(dmContacts).filter(
    ([id, d]) => id !== '__unused' && (d.name || '').toLocaleLowerCase('tr-TR').includes(query)
  );

  const filteredOnline = onlineRiders.filter((u) =>
    (u.name || '').toLocaleLowerCase('tr-TR').includes(query)
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 carbon-bg relative">

      {/* Search Input Bar */}
      <div className="p-3 bg-zinc-950/80 border-b border-zinc-900 space-y-3">
        <WeatherWidget />
        <div className="flex items-center gap-2">
          <div className="rounded-2xl flex items-center px-4 py-2.5 biker-input flex-1">
            <Search className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Kortej veya sürücü ara..."
              className="bg-transparent outline-none text-sm w-full ml-3 text-white placeholder-zinc-500 font-medium"
            />
          </div>
          <button
            onClick={onOpenAddRider}
            className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 text-sky-400 flex items-center justify-center biker-btn hover:border-sky-500/50"
            title="Sürücü Ekle"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main List Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60">
        {/* Cortege Groups */}
        {filteredGroups.map(([id, g]) => {
          const info = g.info || {};
          return (
            <div
              key={id}
              className="w-full flex items-center justify-between p-3.5 hover:bg-zinc-900/80 transition group"
            >
              <button
                type="button"
                onClick={() => onOpenChat(id, info.name || 'Kortej', info.avatar || '🏍️')}
                className="text-left flex items-center gap-4 min-w-0 flex-1 bg-transparent"
              >
                <div
                  className={`w-13 h-13 rounded-2xl bg-gradient-to-tr ${
                    info.color || 'from-neutral-700 to-neutral-900'
                  } flex items-center justify-center text-white text-2xl shrink-0 border border-white/10 shadow-md`}
                >
                  {info.avatar || '🏍️'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-white text-lg uppercase tracking-wide truncate">
                    {info.name || 'Kortej'}
                  </h3>
                  <p className="text-xs text-zinc-400 flex items-center gap-1">
                    <Users className="w-3 h-3 text-orange-500" />
                    <span>Kortej sohbet odası</span>
                  </p>
                </div>
              </button>

              {id !== 'global' && (
                <button
                  type="button"
                  onClick={() => onDeleteGroup(id, info.name || 'Kortej')}
                  className="w-9 h-9 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 shrink-0 flex items-center justify-center biker-btn transition ml-2"
                  title="Korteji Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}

        {/* DM Contacts */}
        {filteredDms.map(([id, d]) => (
          <div
            key={id}
            className="w-full flex items-center justify-between p-3.5 hover:bg-zinc-900/80 transition group"
          >
            <button
              type="button"
              onClick={() => onOpenChat(id, d.name || 'Rider', d.avatar || '🏍️')}
              className="text-left flex items-center gap-4 min-w-0 flex-1 bg-transparent"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white text-2xl shrink-0 border border-white/10 shadow-md">
                {d.avatar || '🏍️'}
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-white text-lg truncate">
                  {d.name || 'Rider'}
                </h3>
                <p className="text-xs text-orange-400">Sürücü Birebir Sohbet</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onDeleteDm(id, d.name || 'Rider')}
              className="w-9 h-9 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 shrink-0 flex items-center justify-center biker-btn transition ml-2"
              title="Kişiyi Sohbet Listesinden Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Empty state when no search matches */}
        {filteredGroups.length === 0 && filteredDms.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-sm">
            Aramanızla eşleşen bir kortej veya sürücü bulunamadı.
          </div>
        )}

        {/* Online Riders Section */}
        {filteredOnline.length > 0 && (
          <section className="border-t border-zinc-800/80 mt-3 pt-2">
            <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Çevrimiçi Riders ({filteredOnline.length})</span>
            </div>

            {filteredOnline.map((u) => {
              const dmId = 'dm_' + [localStorage.getItem('rider_device_id') || '', u.id].sort().join('_');
              return (
                <div
                  key={u.id}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-zinc-900/60 transition border-b border-zinc-900/40 gap-2"
                >
                  <button
                    onClick={() => onOpenChat(dmId, u.name, u.avatar || '🏍️')}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white text-xl shrink-0 shadow-md">
                      {u.avatar || '🏍️'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm truncate">{u.name}</div>
                      <div className="text-[10px] text-emerald-400 font-medium">● Şimdi çevrimiçi</div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onOpenChat(dmId, u.name, '👤')}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-700/80 hover:bg-sky-600 text-white flex items-center justify-center biker-btn shadow-sm"
                      title="Mesaj Gönder"
                    >
                      <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => onStartCall({ id: u.id, name: u.name }, 'video')}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-700/80 hover:bg-indigo-600 text-white flex items-center justify-center biker-btn shadow-sm"
                      title="Görüntülü Ara"
                    >
                      <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => onHideRider(u.id, u.name)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-950/40 hover:bg-red-900 text-red-400 border border-red-900/40 flex items-center justify-center biker-btn shadow-sm"
                      title="Rider'ı Gizle"
                    >
                      <UserX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      {/* Floating Action Button for New Cortege */}
      <button
        onClick={onOpenNewGroup}
        className="absolute bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-2xl shadow-xl flex items-center justify-center z-20 border border-orange-400/40 biker-btn active:scale-95"
        title="Yeni Kortej Oluştur"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
};
