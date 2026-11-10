import React, { useState } from 'react';
import { X, UserPlus, Hash } from 'lucide-react';

interface AddRiderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRider: (name: string, id: string) => void;
}

export const AddRiderModal: React.FC<AddRiderModalProps> = ({ isOpen, onClose, onAddRider }) => {
  const [name, setName] = useState('');
  const [riderId, setRiderId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      // Use provided ID or generate a random one
      const finalId = riderId.trim() || 'rider_' + Math.random().toString(36).slice(2);
      onAddRider(name.trim(), finalId);
      setName('');
      setRiderId('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-white uppercase tracking-wide">
                RIDER EKLE
              </h3>
              <p className="text-xs text-zinc-400">Rehbere yeni bir sürücü ekle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center biker-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wide">
              Sürücü Adı
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sürücü takma adı..."
              className="w-full rounded-xl px-4 py-3 bg-zinc-950 border border-zinc-700 text-white outline-none focus:border-orange-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Hash className="w-3 h-3" />
              Sürücü ID (İsteğe bağlı)
            </label>
            <input
              type="text"
              value={riderId}
              onChange={(e) => setRiderId(e.target.value)}
              placeholder="Örn: rider_xyz123"
              className="w-full rounded-xl px-4 py-3 bg-zinc-950 border border-zinc-700 text-white outline-none focus:border-sky-500 text-sm font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs uppercase tracking-wider biker-btn shadow-lg mt-2"
          >
            Sürücüyü Ekle
          </button>
        </form>
      </div>
    </div>
  );
};
