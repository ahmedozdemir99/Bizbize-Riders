import React, { useState, useMemo } from 'react';
import { X, Map as MapIcon, Navigation, Layers, ExternalLink, ShieldCheck } from 'lucide-react';
import { LiveMap } from '../LiveMap';
import { Message, LocationData } from '../../types';

interface GroupMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
}

export const GroupMapModal: React.FC<GroupMapModalProps> = ({
  isOpen,
  onClose,
  messages,
}) => {
  const [viewMode, setViewMode] = useState<'google' | 'radar'>('google'); // Default to pure Google Maps
  const [mapType, setMapType] = useState<'m' | 'k'>('m'); // 'm' = Roadmap, 'k' = Satellite

  // Find latest location or fallback to Yomra, Trabzon
  const latestLoc = useMemo<LocationData>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === 'location' && m.url) {
        try {
          const loc = JSON.parse(m.url);
          if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
            return loc;
          }
        } catch {}
      }
    }
    return { lat: 40.9568, lng: 39.8617 };
  }, [messages]);

  if (!isOpen) return null;

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latestLoc.lat},${latestLoc.lng}`;
  const embedUrl = `https://maps.google.com/maps?q=${latestLoc.lat},${latestLoc.lng}&hl=tr&z=15&t=${mapType}&output=embed`;

  return (
    <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
          <div className="flex items-center gap-2 text-white font-bold">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-500">
              <MapIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">Kortej Haritası</span>
                <span className="px-1.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-[9px] font-mono font-bold text-orange-400">
                  {viewMode === 'google' ? 'Google Haritalar' : 'Radar Katmanı'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono">
                {latestLoc.lat.toFixed(5)}, {latestLoc.lng.toFixed(5)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle: Google Maps vs Radar */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-0.5 flex items-center text-xs font-bold">
              <button
                onClick={() => setViewMode('google')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  viewMode === 'google'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Google Harita
              </button>
              <button
                onClick={() => setViewMode('radar')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  viewMode === 'radar'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Radar
              </button>
            </div>

            {viewMode === 'google' && (
              <button
                onClick={() => setMapType((prev) => (prev === 'm' ? 'k' : 'm'))}
                className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 flex items-center gap-1 text-[11px] font-bold"
                title="Uydu / Sokak Görünümü Değiştir"
              >
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden sm:inline">{mapType === 'k' ? 'Uydu' : 'Sokak'}</span>
              </button>
            )}

            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden p-2 bg-zinc-950 relative">
          {viewMode === 'google' ? (
            <div className="w-full h-full rounded-2xl overflow-hidden border border-zinc-800 relative bg-zinc-900">
              <iframe
                title="Google Haritalar Kortej Görünümü"
                src={embedUrl}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <LiveMap messages={messages} className="h-full w-full" />
          )}
        </div>

        {/* Footer Quick Action */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 shrink-0 flex items-center justify-between gap-3">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 biker-btn transition active:scale-98"
          >
            <Navigation className="w-4 h-4 fill-current" />
            <span>Google Haritalar Uygulamasında Aç & Yol Tarifi Al</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
};
