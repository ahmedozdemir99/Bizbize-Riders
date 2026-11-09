import React, { useState } from 'react';
import { X, Copy, Check, Database, Server, RefreshCw } from 'lucide-react';
import { SUPABASE_SQL_SCHEMA, getStoredSupabaseConfig } from '../services/supabase';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (url: string, key: string) => void;
}

export const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose, onSaveConfig }) => {
  const currentConfig = getStoredSupabaseConfig();
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(currentConfig.url);
  const [key, setKey] = useState(currentConfig.key);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(url, key);
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-500">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-white uppercase tracking-wide">
                Veritabanı & Sunucu Ayarları
              </h3>
              <p className="text-xs text-zinc-400">Supabase SQL kurulumu ve API yapılandırması</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic Banner */}
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
          <Server className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Sunucu Bağlantı Notu:</div>
            <div>
              Varsayılan Supabase projesine ulaşılamadığında ("Failed to fetch"), uygulama otomatik olarak <strong>Yerel Çevrimdışı Modda</strong> çalışmaya devam eder. Kendi Supabase projenizin URL ve Anon Key bilgilerini aşağıya girerek canlı sunucuya bağlanabilirsiniz.
            </div>
          </div>
        </div>

        {/* Custom Supabase Credentials Form */}
        <form onSubmit={handleSave} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-orange-400 tracking-wider">
            <Server className="w-4 h-4" />
            <span>Supabase Bağlantı Bilgileri</span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Supabase Project URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyz.supabase.co"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Supabase Publishable / Anon Key</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sb_publishable_..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ayarları Kaydet ve Yeniden Bağlan</span>
            </button>
          </div>
        </form>

        {/* SQL Schema Copy Box */}
        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
              Supabase SQL Tablo Kurulum Kodu (DDL)
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-orange-400 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-zinc-700 transition active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Kopyalandı!' : 'SQL Kopyala'}</span>
            </button>
          </div>

          <div className="relative flex-1 min-h-[180px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <textarea
              readOnly
              value={SUPABASE_SQL_SCHEMA}
              className="w-full h-full bg-transparent text-[11px] font-mono text-emerald-400/90 outline-none resize-none leading-relaxed"
            />
          </div>
          <p className="text-[11px] text-zinc-500">
            * Bu kodu Supabase panolunuzdaki <strong>SQL Editor</strong> bölümüne yapıştırıp <strong>Run</strong> düğmesine tıklayarak tüm veritabanı tablolarını 1 saniyede otomatik oluşturabilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
};
