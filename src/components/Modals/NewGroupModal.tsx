import React, { useState } from 'react';
import { X, Users } from 'lucide-react';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (name: string) => Promise<boolean>;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({ isOpen, onClose, onCreateGroup }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || loading) return;
    setLoading(true);
    try {
      if (!await onCreateGroup(trimmed)) return;
      setName('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-500">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-white uppercase tracking-wide">
                YENİ KORTEJ
              </h3>
              <p className="text-xs text-zinc-400">Yeni bir sohbet grubu oluştur</p>
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
            <label htmlFor="groupNameInput" className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wide">
              Kortej Adı
            </label>
            <input
              id="groupNameInput"
              type="text"
              maxLength={70}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Karadeniz Riders 🏍️"
              autoFocus
              className="w-full rounded-xl px-4 py-3 bg-zinc-950 border border-zinc-700 text-white outline-none focus:border-orange-500 text-sm font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider biker-btn"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={loading || name.trim().length < 2}
              className="py-3 rounded-xl bg-orange-600 disabled:opacity-40 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider biker-btn shadow-lg"
            >
              {loading ? 'Oluşturuluyor...' : 'Kortej Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
