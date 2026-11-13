import { useState, type FormEvent } from 'react';
import { ArrowRight, Database, MessageSquare, Radar, Route } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface LoginScreenProps {
  onLogin: (name: string) => void;
  onOpenSqlModal: () => void;
}

export function LoginScreen({ onLogin, onOpenSqlModal }: LoginScreenProps) {
  const [name, setName] = useState(() => localStorage.getItem('rider_username') || '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nickname = name.trim();
    if (nickname.length >= 2) onLogin(nickname);
  }

  return (
    <section className="riders-welcome">
      <div className="riders-cover">
        <div className="riders-brand">
          <BrandLogo className="size-11 shrink-0 rounded-xl" />
          <span>BizBize <span className="text-orange-400">Riders</span></span>
        </div>
        <div className="riders-intro">
          <h1 className="text-white">Yol bizi<br /><span className="text-orange-400">birleştirir.</span></h1>
          <p>Sürüşünü planla, kortejinle haberleş ve yol boyunca bağlantıda kal.</p>
          <ul aria-label="Uygulama özellikleri">
            <li><Route aria-hidden="true" /> Sürüş planları</li>
            <li><MessageSquare aria-hidden="true" /> Kortej sohbeti</li>
            <li><Radar aria-hidden="true" /> Canlı radar</li>
          </ul>
        </div>
      </div>

      <div className="riders-entry">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Sürücü girişi</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">Kortejde görünecek sürücü adını gir. Sürüş planlarını bağlantı olmadan da hazırlayabilirsin.</p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="rider-nickname" className="mb-2 block text-sm font-bold text-zinc-200">Sürücü adın</label>
              <input
                id="rider-nickname"
                minLength={2}
                required
                type="text"
                maxLength={40}
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Sürücü adını yaz"
                autoComplete="nickname"
                className="biker-input min-h-12 w-full rounded-xl px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              />
            </div>
            <button type="submit" disabled={name.trim().length < 2}
              className="flex min-h-12 w-full items-center justify-between rounded-xl bg-orange-500 px-4 font-bold text-zinc-950 hover:bg-orange-400 disabled:opacity-55">
              Kontağı Çevir <ArrowRight aria-hidden="true" className="size-5" />
            </button>
          </form>
          <button type="button" onClick={onOpenSqlModal}
            className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm text-zinc-300 hover:text-orange-400">
            <Database aria-hidden="true" className="size-4" /> Veritabanı / Supabase Ayarları
          </button>
        </div>
      </div>
    </section>
  );
}
