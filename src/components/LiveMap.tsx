import React, { useEffect, useRef } from 'react';
import { Message, LocationData } from '../types';

declare global {
  interface Window {
    L: any;
  }
}

interface LiveMapProps {
  messages: Message[];
  className?: string;
}

export const LiveMap: React.FC<LiveMapProps> = ({ messages, className = 'h-64 w-full' }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    // Filter only 'live' location messages
    const liveLocations = messages.filter((m) => {
      if (m.type !== 'location' || !m.url) return false;
      try {
        const loc: LocationData = JSON.parse(m.url);
        return !m.deleted && loc.live === true && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
          && Math.abs(loc.lat) <= 90 && Math.abs(loc.lng) <= 180;
      } catch {
        return false;
      }
    });

    if (!mapInstanceRef.current) {
      // Initialize map
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([0, 0], 2);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    
    // Update/Add markers for all active live locations
    const activeIds = new Set<string>();
    
    liveLocations.forEach((m) => {
      const loc: LocationData = JSON.parse(m.url!);
      const markerId = m.sender_id;
      activeIds.add(markerId);

      const icon = window.L.divIcon({
        className: 'custom-biker-map-icon',
        html: `<div class="w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold animate-pulse">
          🏍️
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      if (markersRef.current[markerId]) {
        markersRef.current[markerId].setLatLng([loc.lat, loc.lng]);
      } else {
        markersRef.current[markerId] = window.L.marker([loc.lat, loc.lng], { icon })
          .addTo(map)
          .bindPopup(Object.assign(document.createElement('span'), { textContent: m.sender_name }));
      }
    });

    // Remove markers for inactive users
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    // Fit bounds safely
    if (liveLocations.length > 0 && Object.keys(markersRef.current).length > 0) {
      try {
        const markerArray = Object.values(markersRef.current);
        if (markerArray.length === 1) {
          const latLng = markerArray[0].getLatLng();
          map.setView(latLng, 15);
        } else {
          const group = new window.L.featureGroup(markerArray);
          const bounds = group.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds.pad(0.2));
          }
        }
      } catch (err) {
        console.warn('Map fitBounds error:', err);
      }
    }
  }, [messages]);

  useEffect(() => () => {
    mapInstanceRef.current?.remove();
    mapInstanceRef.current = null;
    markersRef.current = {};
  }, []);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute top-2 left-2 z-10 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-orange-400 uppercase tracking-widest">
        Canlı Kortej Konumu
      </div>
    </div>
  );
};
