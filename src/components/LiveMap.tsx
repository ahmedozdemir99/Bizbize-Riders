import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Gauge, Plus, RefreshCw, Eye, EyeOff, Info, Navigation, ExternalLink } from 'lucide-react';
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

interface RiderPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  speed?: number;
  isDemo?: boolean;
}

// Haversine distance in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const LiveMap: React.FC<LiveMapProps> = ({ messages, className = 'h-64 w-full' }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const polylinesRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);
  const distanceTagsRef = useRef<any[]>([]);

  // Takip Mesafesi Asistanı (Following Distance Assistant) state
  const [isAssistantActive, setIsAssistantActive] = useState(true);
  const [cortegeSpeed, setCortegeSpeed] = useState<number>(60); // km/s
  const [includeDemoRiders, setIncludeDemoRiders] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // 2-Second Safety Rule Formula:
  // Safe following distance (m) = Speed (km/h) * (1000 / 3600) * 2 = Speed * 0.555
  const safeDistanceMeters = useMemo(() => {
    return Math.round(cortegeSpeed * 0.555);
  }, [cortegeSpeed]);

  // Extract live locations from messages
  const liveLocations = useMemo(() => {
    return messages
      .filter((m) => {
        if (m.type !== 'location' || !m.url) return false;
        try {
          const loc: LocationData = JSON.parse(m.url);
          return (
            !m.deleted &&
            loc.live === true &&
            Number.isFinite(loc.lat) &&
            Number.isFinite(loc.lng) &&
            Math.abs(loc.lat) <= 90 &&
            Math.abs(loc.lng) <= 180
          );
        } catch {
          return false;
        }
      })
      .map((m) => {
        const loc: LocationData = JSON.parse(m.url!);
        return {
          id: m.sender_id,
          name: m.sender_name,
          lat: loc.lat,
          lng: loc.lng,
          speed: cortegeSpeed,
          isDemo: false,
        } as RiderPoint;
      });
  }, [messages, cortegeSpeed]);

  // Combined real + demo riders for immediate testability
  const activeRiders: RiderPoint[] = useMemo(() => {
    const list = [...liveLocations];
    
    // If user requested demo cortege riders or if room is empty
    if (includeDemoRiders || list.length === 0) {
      const baseLat = list.length > 0 ? list[0].lat : 41.0082; // Default Istanbul / Marmara or user pos
      const baseLng = list.length > 0 ? list[0].lng : 28.9784;

      if (list.length === 0) {
        list.push({
          id: 'demo-lead',
          name: 'Kortej Lideri (Öncü)',
          lat: baseLat + 0.0006,
          lng: baseLng + 0.0007,
          speed: cortegeSpeed,
          isDemo: true,
        });
      }

      list.push({
        id: 'demo-rider-1',
        name: 'Rüzgar Biker',
        lat: baseLat - 0.00045, // ~50m behind
        lng: baseLng - 0.0005,
        speed: cortegeSpeed,
        isDemo: true,
      });

      list.push({
        id: 'demo-rider-2',
        name: 'Kaan Demir (Artçı)',
        lat: baseLat - 0.00095, // ~55m behind second rider
        lng: baseLng - 0.0010,
        speed: cortegeSpeed,
        isDemo: true,
      });
    }

    return list;
  }, [liveLocations, includeDemoRiders, cortegeSpeed]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([41.0082, 28.9784], 14);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }
  }, []);

  // Update Riders, Safety Auras, and Distance Vector Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    // 1. Clear previous assistant vector layers
    polylinesRef.current.forEach((poly) => map.removeLayer(poly));
    polylinesRef.current = [];

    circlesRef.current.forEach((c) => map.removeLayer(c));
    circlesRef.current = [];

    distanceTagsRef.current.forEach((t) => map.removeLayer(t));
    distanceTagsRef.current = [];

    // 2. Manage Rider Markers
    const activeIds = new Set<string>();

    activeRiders.forEach((rider) => {
      activeIds.add(rider.id);

      const icon = window.L.divIcon({
        className: 'custom-biker-map-icon',
        html: `
          <div class="relative group cursor-pointer flex flex-col items-center">
            <div class="px-2 py-0.5 rounded-md bg-zinc-950/90 border border-zinc-700 text-white text-[9px] font-bold font-mono whitespace-nowrap shadow-md mb-0.5 pointer-events-none">
              ${rider.name}
            </div>
            <div class="w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold transition-transform hover:scale-110">
              🏍️
            </div>
          </div>
        `,
        iconSize: [36, 48],
        iconAnchor: [18, 48],
      });

      if (markersRef.current[rider.id]) {
        markersRef.current[rider.id].setLatLng([rider.lat, rider.lng]);
        markersRef.current[rider.id].setIcon(icon);
      } else {
        markersRef.current[rider.id] = window.L.marker([rider.lat, rider.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${rider.name}</b><br><span style="font-size:11px;color:#f97316">Kortej Sürücüsü • ${cortegeSpeed} km/s</span>`);
      }

      // Safety Aura Circles (Takip Asistanı Açıkken)
      if (isAssistantActive) {
        const auraCircle = window.L.circle([rider.lat, rider.lng], {
          radius: safeDistanceMeters / 2, // 1 saniyelik acil durma payı halkası
          color: '#f97316',
          weight: 1.5,
          dashArray: '3, 4',
          fillColor: '#f97316',
          fillOpacity: 0.08,
        }).addTo(map);

        circlesRef.current.push(auraCircle);
      }
    });

    // Remove inactive markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    // 3. Draw Following Distance Assistant Vectors between Consecutive Riders
    if (isAssistantActive && activeRiders.length >= 2) {
      for (let i = 0; i < activeRiders.length - 1; i++) {
        const r1 = activeRiders[i];
        const r2 = activeRiders[i + 1];

        const actualDistance = calculateDistanceMeters(r1.lat, r1.lng, r2.lat, r2.lng);
        const midLat = (r1.lat + r2.lat) / 2;
        const midLng = (r1.lng + r2.lng) / 2;

        // Safety Evaluation
        let strokeColor = '#10b981'; // Green: Safe
        let statusText = 'Güvenli';
        let dashStyle = 'none';

        if (actualDistance < safeDistanceMeters * 0.7) {
          // Critical Danger: Less than 70% of safe distance
          strokeColor = '#ef4444'; // Red
          statusText = 'Tehlikeli Yakın!';
          dashStyle = '4, 4';
        } else if (actualDistance < safeDistanceMeters) {
          // Warning: Close following
          strokeColor = '#f59e0b'; // Amber / Yellow
          statusText = 'Dikkat';
          dashStyle = '6, 6';
        }

        // Draw connecting vector polyline
        const polyline = window.L.polyline(
          [
            [r1.lat, r1.lng],
            [r2.lat, r2.lng],
          ],
          {
            color: strokeColor,
            weight: 4,
            opacity: 0.9,
            dashArray: dashStyle === 'none' ? undefined : dashStyle,
          }
        ).addTo(map);

        polylinesRef.current.push(polyline);

        // Distance Tag Badge on Midpoint
        const tagIcon = window.L.divIcon({
          className: 'custom-dist-tag',
          html: `
            <div class="px-2 py-1 rounded-lg border text-[10px] font-mono font-bold shadow-lg flex items-center gap-1 whitespace-nowrap -translate-x-1/2 -translate-y-1/2 ${
              strokeColor === '#10b981'
                ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300'
                : strokeColor === '#f59e0b'
                ? 'bg-amber-950/90 border-amber-500/80 text-amber-300'
                : 'bg-red-950/90 border-red-500/80 text-red-300 animate-pulse'
            }">
              <span>${Math.round(actualDistance)}m</span>
              <span class="opacity-75">/ ${safeDistanceMeters}m</span>
              <span class="text-[9px] uppercase px-1 rounded bg-black/40">${statusText}</span>
            </div>
          `,
          iconSize: [120, 24],
          iconAnchor: [60, 12],
        });

        const tagMarker = window.L.marker([midLat, midLng], {
          icon: tagIcon,
          interactive: false,
        }).addTo(map);

        distanceTagsRef.current.push(tagMarker);
      }
    }

    // 4. Fit Bounds
    if (activeRiders.length > 0 && Object.keys(markersRef.current).length > 0) {
      try {
        const markerArray = Object.values(markersRef.current);
        if (markerArray.length === 1) {
          map.setView(markerArray[0].getLatLng(), 15);
        } else {
          const group = new window.L.featureGroup(markerArray);
          const bounds = group.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds.pad(0.25));
          }
        }
      } catch (err) {
        console.warn('Map bounds fit error:', err);
      }
    }
  }, [activeRiders, isAssistantActive, safeDistanceMeters, cortegeSpeed]);

  // Calculate cortege safety summary
  const cortegeSummary = useMemo(() => {
    if (activeRiders.length < 2) {
      return { status: 'single', message: 'Kortejde en az 2 sürücü olmalıdır.' };
    }
    let minGap = Infinity;
    for (let i = 0; i < activeRiders.length - 1; i++) {
      const dist = calculateDistanceMeters(
        activeRiders[i].lat,
        activeRiders[i].lng,
        activeRiders[i + 1].lat,
        activeRiders[i + 1].lng
      );
      if (dist < minGap) minGap = dist;
    }

    if (minGap < safeDistanceMeters * 0.7) {
      return {
        status: 'danger',
        minGap: Math.round(minGap),
        message: `⚠️ Tehlikeli Yakın Takip (${Math.round(minGap)}m)! Güvenli: ${safeDistanceMeters}m`,
      };
    }
    if (minGap < safeDistanceMeters) {
      return {
        status: 'warning',
        minGap: Math.round(minGap),
        message: `🟡 Dikkat: Takip mesafesi daralıyor (${Math.round(minGap)}m).`,
      };
    }
    return {
      status: 'safe',
      minGap: Math.round(minGap),
      message: `🟢 Tüm sürücüler güvenli mesafede (${Math.round(minGap)}m+).`,
    };
  }, [activeRiders, safeDistanceMeters]);

  return (
    <div className={`relative isolate rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-950 flex flex-col ${className}`}>
      {/* Top Map Floating Control Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
        {/* Assistant Activation Toggle */}
        <div className="pointer-events-auto flex items-center gap-1 bg-zinc-950/90 border border-zinc-800 rounded-xl p-1 shadow-2xl backdrop-blur-md">
          <button
            onClick={() => setIsAssistantActive((prev) => !prev)}
            className={`py-1 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all biker-btn ${
              isAssistantActive
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Takip Mesafesi Asistanı Katmanını Aç/Kapat"
          >
            {isAssistantActive ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>Takip Asistanı</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isAssistantActive ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`} />
          </button>

          <button
            onClick={() => setShowInfoModal(true)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            title="Güvenli Takip Mesafesi Kuralı Hakkında Bilgi"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Adjustment Chips */}
        {isAssistantActive && (
          <div className="pointer-events-auto flex items-center gap-1 bg-zinc-950/90 border border-zinc-800 rounded-xl p-1 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-1 px-1 text-[10px] font-mono text-zinc-400">
              <Gauge className="w-3 h-3 text-orange-400" />
              <span className="hidden sm:inline">Hız:</span>
            </div>
            {[40, 60, 80, 100].map((s) => (
              <button
                key={s}
                onClick={() => setCortegeSpeed(s)}
                className={`py-0.5 px-2 rounded-lg text-[11px] font-mono font-bold transition ${
                  cortegeSpeed === s
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Demo Riders Toggle (For testing without multiple physical devices) */}
        <div className="pointer-events-auto flex items-center gap-1">
          <button
            onClick={() => setIncludeDemoRiders((prev) => !prev)}
            className={`py-1 px-2 rounded-xl text-[11px] font-bold flex items-center gap-1 transition shadow-2xl backdrop-blur-md ${
              includeDemoRiders
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-zinc-950/90 text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-800'
            }`}
            title="Haritaya simüle edilmiş kortej sürücüleri ekle"
          >
            <Plus className="w-3 h-3" />
            <span>{includeDemoRiders ? 'Kortej (Aktif)' : '+ Kortej'}</span>
          </button>

          {/* Quick Google Maps Launch */}
          {activeRiders.length > 0 && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${activeRiders[0].lat},${activeRiders[0].lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-1 px-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-2xl backdrop-blur-md transition biker-btn active:scale-95 border border-orange-400/30"
              title="Kortej konumunu Google Haritalar'da aç"
            >
              <Navigation className="w-3 h-3 fill-current" />
              <span>Haritalar</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Map Container */}
      <div ref={mapContainerRef} className="w-full flex-1 min-h-[220px] z-0" />

      {/* Bottom HUD: Live Cortege Safety Status */}
      {isAssistantActive && (
        <div className="p-2.5 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between gap-2 z-10 shrink-0 text-xs font-mono">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                cortegeSummary.status === 'safe'
                  ? 'bg-emerald-400 animate-pulse'
                  : cortegeSummary.status === 'warning'
                  ? 'bg-amber-400 animate-pulse'
                  : cortegeSummary.status === 'danger'
                  ? 'bg-red-500 animate-ping'
                  : 'bg-zinc-500'
              }`}
            />
            <span className="text-[11px] text-zinc-200 truncate">
              {cortegeSummary.message}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-[10px]">
            <span className="text-zinc-500">2 Sn Kuralı:</span>
            <span className="text-orange-400 font-bold bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
              {cortegeSpeed} km/s ➔ {safeDistanceMeters}m
            </span>
          </div>
        </div>
      )}

      {/* Info Rule Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-orange-500/50 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Motosiklet Takip Mesafesi Asistanı</span>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-zinc-400 hover:text-white p-1 text-xs"
              >
                ✕ Kapat
              </button>
            </div>

            <div className="space-y-2 text-xs text-zinc-300 leading-relaxed">
              <p>
                <strong>2 Saniye Kuralı (Fermuar Düzeni):</strong> Kortej sürüşlerinde güvenli takip mesafesi, öndeki sürücüyle aranızda en az 2 saniyelik reaksiyon ve fren mesafesi bulunmasını gerektirir.
              </p>
              <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-emerald-400">
                  <span>🟢 Güvenli:</span>
                  <span>Mesafe ≥ {safeDistanceMeters} m</span>
                </div>
                <div className="flex justify-between text-amber-400">
                  <span>🟡 Dikkat (Yakın):</span>
                  <span>{Math.round(safeDistanceMeters * 0.7)} m - {safeDistanceMeters} m</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>🔴 Tehlike (Acil):</span>
                  <span>&lt; {Math.round(safeDistanceMeters * 0.7)} m</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 italic">
                Hızı artırdıkça gerekli güvenli takip mesafesi dinamik olarak genişler.
              </p>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs biker-btn"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
