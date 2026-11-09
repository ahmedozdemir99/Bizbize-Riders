import React, { useEffect, useRef } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { LocationData } from '../types';

declare global {
  interface Window {
    L: any;
  }
}

interface MapPickerProps {
  location: LocationData;
  isLive?: boolean;
  className?: string;
  onOpenExternal?: () => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  location,
  isLive,
  className = 'h-48 w-full',
  onOpenExternal,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    const { lat, lng } = location;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], 15);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Custom marker icon
      const icon = window.L.divIcon({
        className: 'custom-biker-map-icon',
        html: `<div class="w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold ${
          isLive ? 'animate-bounce' : ''
        }">
          <span style="font-size: 14px;">📍</span>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = window.L.marker([lat, lng], { icon }).addTo(map);
      markerRef.current = marker;
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([lat, lng]);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
    }
  }, [location.lat, location.lng, isLive]);

  const mapsUrl = `https://maps.google.com/?q=${location.lat},${location.lng}`;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[160px] z-0" />
      
      {/* Overlay Information */}
      <div className="absolute top-2 left-2 z-10 bg-zinc-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-zinc-700/60 flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
        <MapPin className={`w-3.5 h-3.5 ${isLive ? 'text-emerald-400 animate-pulse' : 'text-orange-500'}`} />
        <span>{isLive ? 'Canlı Konum' : 'Sabit Konum'}</span>
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpenExternal}
        className="absolute bottom-2 right-2 z-10 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 transition active:scale-95"
      >
        <Navigation className="w-3.5 h-3.5" />
        <span>Haritada Aç</span>
      </a>

      <div className="absolute bottom-2 left-2 z-10 bg-zinc-900/90 backdrop-blur-md text-[10px] text-zinc-400 font-mono px-2 py-0.5 rounded border border-zinc-800">
        {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
      </div>
    </div>
  );
};
