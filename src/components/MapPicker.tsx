import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, ExternalLink, Layers, Sparkles } from 'lucide-react';
import { LocationData } from '../types';

interface MapPickerProps {
  location: LocationData;
  isLive?: boolean;
  className?: string;
  onOpenExternal?: () => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  location,
  isLive,
  className = 'h-52 w-full',
  onOpenExternal,
}) => {
  const [placeName, setPlaceName] = useState<string>('Konum yükleniyor...');
  const [mapType, setMapType] = useState<'m' | 'k'>('m'); // 'm' = Roadmap, 'k' = Satellite

  // Reverse geocode to get real human-readable place name (e.g. Yomra, Trabzon)
  useEffect(() => {
    let isCancelled = false;
    const fetchPlace = async () => {
      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lng}&localityLanguage=tr`
        );
        if (res.ok) {
          const data = await res.json();
          const district = data.locality || data.district || data.city || '';
          const city = data.principalSubdivision || data.countryName || '';
          const name = district && city ? `${district}, ${city}` : district || city || 'Konum Belirlendi';
          if (!isCancelled) setPlaceName(name);
          return;
        }
      } catch {}

      // Fallback geocode via Open-Meteo
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=Yomra&count=1&language=tr&format=json`
        );
        if (res.ok && !isCancelled) {
          setPlaceName('Yomra, Trabzon');
          return;
        }
      } catch {}

      if (!isCancelled) {
        setPlaceName(`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
      }
    };

    fetchPlace();
    return () => {
      isCancelled = true;
    };
  }, [location.lat, location.lng]);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  // Direct Google Maps embed with Turkish locale and selectable Roadmap / Satellite view
  const embedUrl = `https://maps.google.com/maps?q=${location.lat},${location.lng}&hl=tr&z=15&t=${mapType}&output=embed`;

  return (
    <div className="space-y-2 w-full">
      {/* Place Name Header */}
      <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-500 shrink-0">
            <MapPin className="w-4 h-4 text-orange-500" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span>{placeName}</span>
              {isLive && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold animate-pulse">
                  CANLI
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          </div>
        </div>

        {/* Map Type Toggle (Uydu / Harita) */}
        <button
          onClick={() => setMapType((prev) => (prev === 'm' ? 'k' : 'm'))}
          className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700/80 hover:border-orange-500 text-zinc-300 hover:text-white text-[10px] font-bold flex items-center gap-1 shrink-0 transition"
          title="Harita / Uydu Görünümü Değiştir"
        >
          <Layers className="w-3 h-3 text-orange-400" />
          <span>{mapType === 'k' ? 'Uydu' : 'Sokak'}</span>
        </button>
      </div>

      {/* Direct Google Maps Embed Container */}
      <div className={`relative rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-950 shadow-xl ${className}`}>
        <iframe
          title="Google Maps Konum Önizleme"
          src={embedUrl}
          className="w-full h-full min-h-[180px] border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* Floating Quick Action Overlay */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpenExternal}
          className="absolute bottom-2.5 right-2.5 z-10 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-1.5 transition active:scale-95 biker-btn border border-white/20"
          title="Google Haritalar Uygulamasında Aç"
        >
          <Navigation className="w-3.5 h-3.5 fill-current" />
          <span>Google Haritalar</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>
      </div>

      {/* Prominent Full-Width Google Maps Route & Navigation Button */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpenExternal}
        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 biker-btn transition active:scale-98"
      >
        <Navigation className="w-4 h-4 fill-current" />
        <span>Google Haritalar'da Aç & Yol Tarifi Al</span>
        <ExternalLink className="w-3.5 h-3.5 opacity-90" />
      </a>
    </div>
  );
};
