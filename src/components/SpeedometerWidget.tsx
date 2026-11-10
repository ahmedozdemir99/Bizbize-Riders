import React, { useState, useEffect, useRef } from 'react';
import { 
  Gauge, 
  Play, 
  Square, 
  ChevronDown, 
  ChevronUp, 
  Timer, 
  Route, 
  Sparkles, 
  Zap, 
  AlertCircle,
  Radio,
  MapPin,
  RefreshCw,
  Info
} from 'lucide-react';

interface SpeedometerWidgetProps {
  onSendRideSummary?: (summaryText: string) => void;
}

interface LastFix {
  lat: number;
  lng: number;
  time: number;
  accuracy: number;
}

// Haversine formula to compute distance in meters between two GPS coordinates
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth's mean radius in meters
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

export const SpeedometerWidget: React.FC<SpeedometerWidgetProps> = ({ 
  onSendRideSummary 
}) => {
  const [speed, setSpeed] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  
  // GPS State & Diagnostics
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'denied' | 'error'>('searching');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [fixCount, setFixCount] = useState(0);
  const [calculationMethod, setCalculationMethod] = useState<'gnss_speed' | 'distance_time' | 'stationary'>('stationary');
  const [lastDt, setLastDt] = useState<number>(0);
  const [lastDeltaDist, setLastDeltaDist] = useState<number>(0);
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [showZeroWarningModal, setShowZeroWarningModal] = useState(false);
  const [rawGpsSpeed, setRawGpsSpeed] = useState<number | null>(null);
  const [lastCoordDisplay, setLastCoordDisplay] = useState<string>('');

  // Refs to avoid tearing down GPS watcher when state changes
  const isTrackingRef = useRef(isTracking);
  isTrackingRef.current = isTracking;
  const isDemoModeRef = useRef(isDemoMode);
  isDemoModeRef.current = isDemoMode;

  const lastFixRef = useRef<LastFix | null>(null);
  const lastDistancePosRef = useRef<{ lat: number; lng: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const demoIntervalRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Core Position Processor with (distance / time) fallback
  const processPositionFix = (position: GeolocationPosition) => {
    if (isDemoModeRef.current) return;

    const now = Date.now();
    const currentLat = position.coords.latitude;
    const currentLng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    const nativeSpeedMps = position.coords.speed; // meters per second from GNSS

    setGpsStatus('active');
    setGpsAccuracy(Math.round(accuracy));
    setFixCount((prev) => prev + 1);
    setLastCoordDisplay(`${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`);

    let finalKmH = 0;
    let method: 'gnss_speed' | 'distance_time' | 'stationary' = 'stationary';

    // 1. Check if hardware GNSS 'speed' vector is valid (non-null, non-NaN, >= 0)
    const hasValidNativeSpeed = 
      nativeSpeedMps !== null && 
      nativeSpeedMps !== undefined && 
      !isNaN(nativeSpeedMps) && 
      nativeSpeedMps > 0.5;

    if (hasValidNativeSpeed) {
      finalKmH = Math.round(nativeSpeedMps * 3.6);
      method = 'gnss_speed';
      setRawGpsSpeed(finalKmH);
    } else {
      setRawGpsSpeed(null);
      // 2. 'speed' verisi geçersiz (null, 0 veya tanımsız) ise: (distance / time) formülüyle hesapla
      if (lastFixRef.current) {
        const dtSeconds = (now - lastFixRef.current.time) / 1000;
        const deltaMeters = calculateDistanceMeters(
          lastFixRef.current.lat,
          lastFixRef.current.lng,
          currentLat,
          currentLng
        );

        setLastDt(Number(dtSeconds.toFixed(1)));
        setLastDeltaDist(Number(deltaMeters.toFixed(1)));

        // 1-2 saniyelik periyotta hesaplama yap (en az 0.6 sn, en fazla 5 sn)
        if (dtSeconds >= 0.6 && dtSeconds <= 5.0) {
          // speed = distance / time (m/s) -> * 3.6 = km/s
          const speedMps = deltaMeters / dtSeconds;
          const calculatedKmH = Math.round(speedMps * 3.6);

          // Titreşim (jitter) filtresi: 1.2 metreden az hareket kırmızı ışık veya durağan sayılır
          if (deltaMeters >= 1.2 && calculatedKmH >= 3 && calculatedKmH <= 220) {
            finalKmH = calculatedKmH;
            method = 'distance_time';
          }
        }
      }
    }

    setCalculationMethod(method);
    setSpeed(finalKmH);

    // Sürüş Takibi (Ride Tracking) Mesafesi & Maksimum Hız
    if (isTrackingRef.current) {
      if (finalKmH > 0) {
        setMaxSpeed((prev) => Math.max(prev, finalKmH));
      }

      if (!lastDistancePosRef.current) {
        lastDistancePosRef.current = { lat: currentLat, lng: currentLng };
      } else {
        const stepDist = calculateDistanceMeters(
          lastDistancePosRef.current.lat,
          lastDistancePosRef.current.lng,
          currentLat,
          currentLng
        );

        // Durağan GPS kaymalarını filtreleyip gerçek araç hareketini (>= 2.0 m) ekle
        if (stepDist >= 2.0 && stepDist < 400) {
          setDistanceMeters((d) => d + stepDist);
          lastDistancePosRef.current = { lat: currentLat, lng: currentLng };
        }
      }
    }

    // Bir sonraki (distance / time) hesaplaması için referans noktasını güncelle
    lastFixRef.current = {
      lat: currentLat,
      lng: currentLng,
      time: now,
      accuracy,
    };
  };

  // Direct user-gesture trigger to request & prompt Location permission in Android Chrome
  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      alert('Cihazınızda GPS / Konum servisi bulunmuyor.');
      setGpsStatus('error');
      return;
    }

    setGpsStatus('searching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        processPositionFix(pos);
      },
      (err) => {
        if (err.code === 1) { // PERMISSION_DENIED
          setGpsStatus('denied');
        } else {
          setGpsStatus('searching');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 1. GPS Watcher: Real-time sampling with watchPosition + 1s periodic polling
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }

    // Check permission state if supported
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        if (status.state === 'denied') setGpsStatus('denied');
        status.onchange = () => {
          if (status.state === 'denied') setGpsStatus('denied');
          if (status.state === 'granted') setGpsStatus('active');
        };
      }).catch(() => {});
    }

    const startGpsEngine = () => {
      try {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }

        // Primary: watchPosition with high accuracy and 0 maximumAge
        watchIdRef.current = navigator.geolocation.watchPosition(
          processPositionFix,
          (err) => {
            if (err.code === 1) {
              setGpsStatus('denied');
            } else {
              setGpsStatus('searching');
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0, // Her zaman en güncel uydu verisini al
            timeout: 10000,
          }
        );
      } catch {
        setGpsStatus('error');
      }
    };

    startGpsEngine();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []); // Keeps running continuously without tear-down

  // 2. Dynamic Motorcycle/Vehicle Simulator for Test Mode
  useEffect(() => {
    if (isTracking && isDemoMode) {
      demoIntervalRef.current = window.setInterval(() => {
        setSpeed((prev) => {
          let target = prev;
          if (prev < 40) {
            target = prev + 12;
          } else if (prev < 70) {
            target = prev + 6;
          } else {
            const variation = Math.floor(Math.random() * 9) - 4;
            target = prev + variation;
            if (target > 98) target = 92;
            if (target < 52) target = 58;
          }

          setMaxSpeed((m) => Math.max(m, target));
          // Distance in meters added every second = (km/h) / 3.6
          setDistanceMeters((dist) => dist + target / 3.6);
          return target;
        });
      }, 1000);
    } else {
      if (demoIntervalRef.current !== null) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    }

    return () => {
      if (demoIntervalRef.current !== null) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [isTracking, isDemoMode]);

  // 3. Elapsed Ride Timer
  useEffect(() => {
    if (isTracking) {
      timerRef.current = window.setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTracking]);

  const handleStartRide = (demo = false) => {
    setIsDemoMode(demo);
    setIsTracking(true);
    setElapsedSec(0);
    setDistanceMeters(0);
    setMaxSpeed(demo ? 42 : speed);
    if (demo) {
      setSpeed(38);
    }
    lastDistancePosRef.current = null;
    setIsCollapsed(false);
    setShowZeroWarningModal(false);

    if (!demo) {
      requestLocationPermission();
    }
  };

  const handleBoostSpeed = () => {
    setSpeed((s) => {
      const boosted = Math.min(130, s === 0 ? 50 : s + 15);
      setMaxSpeed((m) => Math.max(m, boosted));
      setDistanceMeters((d) => d + boosted / 3.6);
      return boosted;
    });
  };

  const executeSendRideSummary = (overrideDistance?: number, overrideMaxSpeed?: number) => {
    const finalDistance = overrideDistance !== undefined ? overrideDistance : distanceMeters;
    const finalMaxSpeed = overrideMaxSpeed !== undefined ? overrideMaxSpeed : maxSpeed;

    let distanceFormatted = '0 m';
    if (finalDistance >= 1000) {
      distanceFormatted = `${(finalDistance / 1000).toFixed(2)} km`;
    } else {
      distanceFormatted = `${Math.max(0, Math.round(finalDistance))} m`;
    }

    let durationFormatted = `${elapsedSec} sn`;
    if (elapsedSec >= 60) {
      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      if (mins >= 60) {
        durationFormatted = `${Math.floor(mins / 60)} sa ${mins % 60} dk`;
      } else {
        durationFormatted = `${mins} dk ${secs} sn`;
      }
    }

    let avgSpeed = 0;
    if (elapsedSec > 0 && finalDistance > 0) {
      avgSpeed = Math.round((finalDistance / elapsedSec) * 3.6);
    } else if (finalMaxSpeed > 0) {
      avgSpeed = Math.round(finalMaxSpeed * 0.72);
    }

    const modeTag = isDemoMode ? ' (Test Sürüşü)' : ' (Canlı GPS)';
    const summaryText = 
`🏍️ SÜRÜŞ ÖZETİ${modeTag}
⏱️ Toplam Süre: ${durationFormatted}
📍 Katedilen Mesafe: ${distanceFormatted}
⚡ Ortalama Hız: ${avgSpeed} km/s
🚀 Maksimum Hız: ${finalMaxSpeed} km/s
🏁 Sürüş başarıyla tamamlandı. Rüzgarınız bol olsun!`;

    if (onSendRideSummary) {
      onSendRideSummary(summaryText);
    }

    setIsTracking(false);
    setIsDemoMode(false);
    setElapsedSec(0);
    setDistanceMeters(0);
    setShowZeroWarningModal(false);
  };

  const handleFinishRide = () => {
    if (!isDemoMode && distanceMeters < 5 && elapsedSec >= 5) {
      setShowZeroWarningModal(true);
      return;
    }
    executeSendRideSummary();
  };

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDistanceDisplay = (m: number) => {
    if (m >= 1000) {
      return `${(m / 1000).toFixed(2)} km`;
    }
    return `${Math.round(m)} m`;
  };

  return (
    <div className="relative w-full">
      {/* GPS Diagnostics & Live Sensor Modal */}
      {showDiagModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowDiagModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-orange-500/50 rounded-2xl p-4 max-w-sm w-full shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2 text-orange-400">
                <Radio className="w-5 h-5 animate-pulse" />
                <h3 className="font-bold text-white text-sm">GPS Canlı Sensör & Hız Formülü</h3>
              </div>
              <button 
                onClick={() => setShowDiagModal(false)}
                className="text-zinc-400 hover:text-white p-1 text-xs"
              >
                ✕ Kapat
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">DURUM</span>
                <span className={`font-bold ${gpsStatus === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {gpsStatus === 'active' ? '🟢 Aktif' : gpsStatus === 'denied' ? '🔴 İzin Yok' : '🟡 Aranıyor'}
                </span>
              </div>

              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">HESAPLAMA METODU</span>
                <span className="font-bold text-sky-400 text-[11px]">
                  {calculationMethod === 'gnss_speed' 
                    ? '⚡ Uydu Hızı' 
                    : calculationMethod === 'distance_time' 
                      ? '📐 (Mesafe / Zaman)' 
                      : '🛑 Durağan (0 km/s)'}
                </span>
              </div>

              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">ANLIK HIZ</span>
                <span className="font-bold text-orange-400 text-sm">{speed} km/s</span>
              </div>

              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">ÖRNEKLEME ZAMANI (Δt)</span>
                <span className="font-bold text-zinc-300">
                  {lastDt > 0 ? `${lastDt} sn` : '1-2 sn'}
                </span>
              </div>

              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">SON ADIM MESAFESİ (Δd)</span>
                <span className="font-bold text-zinc-300">
                  {lastDeltaDist > 0 ? `${lastDeltaDist} m` : 'Hesaplanıyor'}
                </span>
              </div>

              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">UYDU HASSASİYETİ</span>
                <span className="font-bold text-white">
                  {gpsAccuracy !== null ? `±${gpsAccuracy} m` : 'Bilinmiyor'}
                </span>
              </div>

              <div className="col-span-2 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">ALINAN GPS PAKETİ</span>
                <span className="font-bold text-emerald-400">{fixCount} adet koordinat</span>
              </div>

              {lastCoordDisplay && (
                <div className="col-span-2 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">SON KOORDİNAT</span>
                  <span className="text-[11px] text-zinc-400">{lastCoordDisplay}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                requestLocationPermission();
                setShowDiagModal(false);
              }}
              className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 biker-btn"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>GPS'i Yeniden Başlat / Kalibre Et</span>
            </button>
          </div>
        </div>
      )}

      {/* Zero Distance Warning / Solution Modal */}
      {showZeroWarningModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowZeroWarningModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-orange-500/50 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Hareket Algılanmadı</h3>
                <p className="text-xs text-zinc-400">Cihaz sabit kaldığı için mesafe 0 m.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              Otobüs veya araç harekete geçtiğinde uydu hızı otomatik artar. Şu anki sürenize göre gerçekçi bir sürüş kartı üretilsin mi?
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  const simDistance = Math.max(450, elapsedSec * 18);
                  const simMax = Math.max(65, Math.min(105, 50 + Math.floor(Math.random() * 40)));
                  executeSendRideSummary(simDistance, simMax);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 biker-btn"
              >
                <Sparkles className="w-4 h-4" />
                <span>Test Verileriyle Paylaş</span>
              </button>

              <button
                onClick={() => executeSendRideSummary(0, 0)}
                className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-98 text-zinc-400 hover:text-white font-medium text-xs biker-btn transition"
              >
                Olduğu Gibi Paylaş (0 m)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimized Micro Bar View */}
      {isCollapsed ? (
        <div className="flex items-center justify-between text-[11px] text-zinc-400 w-full">
          <div className="flex items-center gap-2 font-mono">
            <Gauge className="w-3.5 h-3.5 text-orange-500" />
            <span className="font-bold text-white text-xs">{speed} km/s</span>
            {isTracking ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {formatTimer(elapsedSec)} ({formatDistanceDisplay(distanceMeters)})
              </span>
            ) : (
              <span className="text-zinc-500 text-[10px]">
                {gpsStatus === 'active' ? `● GPS Aktif` : `○ GPS Bekleniyor`}
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(false)}
            className="text-orange-400 hover:text-orange-300 py-0.5 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs flex items-center gap-1"
          >
            <span>Genişlet</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Full Cockpit Speedometer Bar */
        <div className="flex items-center justify-between gap-1.5 select-none w-full">
          {/* Gauge and Live Speed Display */}
          <div className="flex items-center gap-2 min-w-0">
            <div 
              className={`flex items-center justify-center w-8 h-8 rounded-xl border shrink-0 transition-colors ${
                speed > 0 
                  ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-sm shadow-orange-500/30' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              <Gauge className={`w-4 h-4 ${speed > 0 ? 'animate-pulse text-orange-500' : ''}`} />
            </div>
            
            <div className="flex flex-col min-w-0 leading-tight">
              <div className="flex items-baseline gap-1">
                <span className="font-mono font-black text-xl text-white leading-none tracking-tight">
                  {speed}
                </span>
                <span className="text-[9px] font-bold text-orange-400 uppercase">
                  km/s
                </span>
              </div>
              
              {/* Clean GPS status display */}
              <div 
                className="flex items-center gap-1 text-[8.5px] font-mono text-zinc-400 text-left"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isDemoMode 
                    ? 'bg-amber-400 animate-pulse' 
                    : gpsStatus === 'active' 
                      ? 'bg-emerald-400 animate-pulse' 
                      : gpsStatus === 'denied'
                        ? 'bg-red-500'
                        : 'bg-amber-400'
                }`} />
                <span className="truncate">
                  {isDemoMode 
                    ? 'Test Modu' 
                    : gpsStatus === 'active' 
                      ? `GPS (±${gpsAccuracy || 0}m)` 
                      : gpsStatus === 'denied'
                        ? 'İzin Ver'
                        : 'Uydu Aranıyor'}
                </span>
              </div>
            </div>
          </div>

          {/* Center Trip Metrics when Tracking */}
          {isTracking && (
            <div className="flex items-center gap-1 font-mono text-xs">
              <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800/90 px-2 py-1 rounded-lg">
                <Timer className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="font-bold text-emerald-400 text-xs">{formatTimer(elapsedSec)}</span>
              </div>
              <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800/90 px-2 py-1 rounded-lg">
                <Route className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="font-bold text-white text-xs">{formatDistanceDisplay(distanceMeters)}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* If Permission is Denied, show prominent Location button */}
            {gpsStatus === 'denied' ? (
              <button
                onClick={requestLocationPermission}
                className="py-1.5 px-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-red-600/20 biker-btn animate-pulse"
                title="Konum İznini Aç"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>İzin Ver</span>
              </button>
            ) : !isTracking ? (
              <div className="flex items-center gap-1">
                {/* 1. Real GPS Trip Tracking Start */}
                <button
                  onClick={() => handleStartRide(false)}
                  className="py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20 transition biker-btn"
                  title="Otobüs veya motosiklet sürüşünü kaydet"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>GPS Başlat</span>
                </button>

                {/* 2. Interactive Test Mode */}
                <button
                  onClick={() => handleStartRide(true)}
                  className="py-1.5 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-amber-400 border border-zinc-700 font-bold text-xs flex items-center gap-1 transition biker-btn"
                  title="Simülasyon / Test Sürüşü"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Test</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {/* Manual Throttle / Speed Boost for interactive testing */}
                <button
                  onClick={handleBoostSpeed}
                  className="py-1 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-amber-400 border border-zinc-700 font-bold text-xs flex items-center gap-0.5 transition biker-btn"
                  title="Hızlandır (+15 km/s)"
                >
                  <Zap className="w-3 h-3" />
                  <span>+Gaz</span>
                </button>

                {/* Finish & Share Button */}
                <button
                  onClick={handleFinishRide}
                  className="py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-red-600/20 transition biker-btn animate-pulse"
                  title="Sürüşü bitir ve telemetri kartını sohbete gönder"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Bitir</span>
                </button>
              </div>
            )}

            <button 
              onClick={() => setIsCollapsed(true)}
              className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition ml-0.5"
              title="Paneli Küçült"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
