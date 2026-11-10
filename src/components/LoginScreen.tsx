import React, { useState } from 'react';
import { Key, Shield, Database } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface LoginScreenProps {
  onLogin: (name: string) => void;
  onOpenSqlModal: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onOpenSqlModal }) => {
  const [name, setName] = useState(localStorage.getItem('rider_username') || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length >= 2) {
      onLogin(name.trim());
    }
  };

  return (
    <section className="flex flex-col h-full w-full items-center justify-center p-6 bg-zinc-950 relative overflow-hidden select-none">
      <div aria-hidden="true" className="absolute -right-32 -bottom-32 w-96 h-96 rounded-full border-[40px] border-zinc-900/40 pointer-events-none" />

      {/* Main Logo Container */}
      <BrandLogo className="w-28 h-28 mb-6 relative z-10 shadow-[0_16px_60px_-12px_rgba(249,115,22,0.35)] rounded-[30px]" />

      <h1 className="font-display font-bold text-4xl text-white tracking-wider uppercase mb-2 relative z-10">
        BizBize <span className="text-orange-500">Riders</span>
      </h1>

      <p className="text-zinc-400 text-sm mb-8 text-center max-w-xs relative z-10 font-medium">
        Sürücü ve kortej iletişim ağına bağlanmak için sürücü adını gir.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4 relative z-10">
        <div className="rounded-2xl flex items-center px-5 py-3.5 biker-input">
          <Shield className="w-5 h-5 text-orange-500 shrink-0" />
          <input
            aria-label="Sürücü adın"
            minLength={2}
            required
            type="text"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sürücü Adın (Rider Nickname)"
            autoComplete="nickname"
            autoFocus
            className="bg-transparent outline-none text-base font-bold text-white w-full ml-3 placeholder-zinc-500"
          />
        </div>

        <button
          type="submit"
          disabled={name.trim().length < 2}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 disabled:opacity-40 hover:from-orange-500 hover:to-orange-400 text-white font-display font-bold text-lg tracking-widest uppercase flex items-center justify-center shadow-xl biker-btn active:scale-95"
        >
          <span>Kontağı Çevir</span>
          <Key className="w-5 h-5 ml-2" />
        </button>

        <button
          type="button"
          onClick={onOpenSqlModal}
          className="w-full py-2.5 text-xs text-zinc-400 hover:text-orange-400 flex items-center justify-center gap-1.5 transition"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Veritabanı / Supabase Ayarları</span>
        </button>
      </form>
    </section>
  );
};
