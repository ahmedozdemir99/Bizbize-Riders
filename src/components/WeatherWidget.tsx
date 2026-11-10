import React, { useState, useEffect, useCallback } from 'react';
import { 
  CloudSun, 
  CloudMoon, 
  Sun, 
  Moon, 
  Wind, 
  Droplets, 
  CloudRain, 
  CloudLightning, 
  CloudFog, 
  Snowflake, 
  RefreshCw, 
  MapPin, 
  Clock,
  Search,
  Check,
  X,
  Navigation
} from 'lucide-react';

interface WeatherData {
  temp: number;
  condition: string;
  wind: number;
  humidity: number;
  isDay: boolean;
  locationName: string;
  updatedAt: string;
  ridingSafety: {
    status: 'good' | 'caution' | 'warning';
    text: string;
  };
}

// Default fallback to user's real location (Yomra, Trabzon) instead of Istanbul
const TRABZON_YOMRA = {
  lat: 40.9568,
  lng: 39.8617,
  name: 'Yomra, Trabzon',
};

const POPULAR_LOCATIONS = [
  { name: 'Yomra, Trabzon', lat: 40.9568, lng: 39.8617 },
  { name: 'Ortahisar, Trabzon', lat: 41.0027, lng: 39.7168 },
  { name: 'Akçaabat, Trabzon', lat: 41.0204, lng: 39.5714 },
  { name: 'Rize Merkez', lat: 41.0201, lng: 40.5234 },
  { name: 'Kadıköy, İstanbul', lat: 40.9819, lng: 29.0576 },
  { name: 'Çankaya, Ankara', lat: 39.9208, lng: 32.8541 },
  { name: 'Konak, İzmir', lat: 38.4192, lng: 27.1287 },
  { name: 'Muratpaşa, Antalya', lat: 36.8841, lng: 30.7056 },
];

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Weather condition and icon resolver based on WMO code and Day/Night
  const resolveWeatherInfo = (code: number, isDay: boolean, windSpeed: number) => {
    let condition = 'Açık';
    let iconType: 'sun' | 'moon' | 'cloud-sun' | 'cloud-moon' | 'rain' | 'storm' | 'fog' | 'snow' = isDay ? 'sun' : 'moon';

    if (code === 0) {
      condition = isDay ? 'Güneşli / Açık' : 'Açık Gece';
      iconType = isDay ? 'sun' : 'moon';
    } else if (code >= 1 && code <= 3) {
      condition = isDay ? 'Parçalı Bulutlu' : 'Bulutlu (Gece)';
      iconType = isDay ? 'cloud-sun' : 'cloud-moon';
    } else if (code >= 45 && code <= 48) {
      condition = 'Sisli / Puslu';
      iconType = 'fog';
    } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      condition = 'Yağmurlu';
      iconType = 'rain';
    } else if (code >= 71 && code <= 77) {
      condition = 'Karlı';
      iconType = 'snow';
    } else if (code >= 95 && code <= 99) {
      condition = 'Fırtınalı / Sağanak';
      iconType = 'storm';
    }

    let safety: { status: 'good' | 'caution' | 'warning'; text: string } = {
      status: 'good',
      text: 'İdeal Sürüş Havası',
    };

    if (iconType === 'storm' || windSpeed > 45) {
      safety = { status: 'warning', text: 'Uyarı: Şiddetli Rüzgar / Fırtına' };
    } else if (iconType === 'rain' || iconType === 'fog' || iconType === 'snow') {
      safety = { status: 'caution', text: 'Dikkat: Islak / Kaygan Zemin' };
    } else if (windSpeed > 28) {
      safety = { status: 'caution', text: 'Dikkat: Yan Rüzgar Etkisi' };
    }

    return { condition, iconType, safety };
  };

  const fetchWeatherForCoords = useCallback(async (lat: number, lng: number, customName?: string, manual = false) => {
    if (manual) setIsRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch live Open-Meteo weather
      const weatherPromise = fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&timezone=auto`
      ).then((res) => res.json());

      // 2. Reverse geocoding only if customName is not provided
      const geoPromise = customName 
        ? Promise.resolve(null)
        : fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=tr`)
            .then((res) => res.json())
            .catch(() => null);

      const [data, geoData] = await Promise.all([weatherPromise, geoPromise]);

      const isDay = data.current?.is_day === 1;
      const weatherCode = data.current?.weather_code ?? 0;
      const windSpeed = Math.round(data.current?.wind_speed_10m ?? 12);
      const temp = Math.round(data.current?.temperature_2m ?? 18);
      const humidity = Math.round(data.current?.relative_humidity_2m ?? 65);

      const { condition, safety } = resolveWeatherInfo(weatherCode, isDay, windSpeed);

      let locName = customName || 'Yomra, Trabzon';
      if (!customName && geoData) {
        const district = geoData.locality || geoData.city || geoData.principalSubdivision;
        const prov = geoData.countryCode === 'TR' ? (geoData.principalSubdivision || geoData.countryName) : geoData.countryName;
        if (district && prov && district !== prov) {
          locName = `${district}, ${prov}`;
        } else if (district || prov) {
          locName = district || prov;
        }
      }

      const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      setWeather({
        temp,
        condition,
        wind: windSpeed,
        humidity,
        isDay,
        locationName: locName,
        updatedAt: nowTime,
        ridingSafety: safety,
      });
    } catch {
      const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setWeather((prev) => prev || {
        temp: 18,
        condition: 'Açık Gece',
        wind: 12,
        humidity: 65,
        isDay: false,
        locationName: customName || 'Yomra, Trabzon',
        updatedAt: nowTime,
        ridingSafety: { status: 'good', text: 'İdeal Sürüş Havası' },
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Main fetch function with High Accuracy GPS + Custom Location Storage
  const fetchWeather = useCallback(async (manual = false) => {
    // 1. Check if user previously selected a specific location
    const stored = localStorage.getItem('bizbize_rider_custom_location');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.lat && parsed.lng) {
          await fetchWeatherForCoords(parsed.lat, parsed.lng, parsed.name, manual);
          return;
        }
      } catch {}
    }

    if (manual) setIsRefreshing(true);
    else setLoading(true);

    // 2. Query high-accuracy GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeatherForCoords(pos.coords.latitude, pos.coords.longitude, undefined, manual);
        },
        () => {
          // If GPS denied/times out on phone, use Yomra, Trabzon directly
          fetchWeatherForCoords(TRABZON_YOMRA.lat, TRABZON_YOMRA.lng, TRABZON_YOMRA.name, manual);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    } else {
      fetchWeatherForCoords(TRABZON_YOMRA.lat, TRABZON_YOMRA.lng, TRABZON_YOMRA.name, manual);
    }
  }, [fetchWeatherForCoords]);

  useEffect(() => {
    fetchWeather();
    const timer = setInterval(() => {
      fetchWeather();
    }, 600000); // 10 minutes

    return () => clearInterval(timer);
  }, [fetchWeather]);

  // Handle custom location selection
  const handleSelectLocation = (loc: { name: string; lat: number; lng: number }) => {
    localStorage.setItem('bizbize_rider_custom_location', JSON.stringify(loc));
    setIsLocationModalOpen(false);
    fetchWeatherForCoords(loc.lat, loc.lng, loc.name, true);
  };

  // Reset to live GPS location
  const handleUseLiveGps = () => {
    localStorage.removeItem('bizbize_rider_custom_location');
    setIsLocationModalOpen(false);
    setLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeatherForCoords(pos.coords.latitude, pos.coords.longitude, undefined, true);
        },
        () => {
          fetchWeatherForCoords(TRABZON_YOMRA.lat, TRABZON_YOMRA.lng, TRABZON_YOMRA.name, true);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  };

  // Search cities/districts via Open-Meteo Geocoding
  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=tr&format=json`);
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        const mapped = data.results.map((r: any) => ({
          name: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country ? ' (' + r.country + ')' : ''}`,
          lat: r.latitude,
          lng: r.longitude,
        }));
        setSearchResults(mapped);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  if (loading && !weather) {
    return (
      <div className="bg-zinc-900/70 p-3 rounded-2xl border border-zinc-800 animate-pulse flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <CloudSun className="w-5 h-5 text-orange-500/50" />
          <span>Trabzon Yomra ve anlık hava durumu yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <>
      {/* Location Picker & City Search Modal */}
      {isLocationModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsLocationModalOpen(false)}
        >
          <div 
            className="bg-zinc-900 border border-orange-500/40 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
                <MapPin className="w-4 h-4" />
                <span>Hava Durumu Konumunu Seç</span>
              </div>
              <button 
                onClick={() => setIsLocationModalOpen(false)}
                className="w-7 h-7 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* GPS Live Button */}
            <button
              onClick={handleUseLiveGps}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Canlı Uydu / GPS Konumunu Kullan</span>
            </button>

            {/* Search Input */}
            <form onSubmit={handleSearchCity} className="flex gap-1.5">
              <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800 flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="İl veya ilçe ara (örn: Yomra)..."
                  className="bg-transparent outline-none text-xs text-white w-full placeholder-zinc-500 font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shrink-0 disabled:opacity-50"
              >
                {isSearching ? '...' : 'Ara'}
              </button>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold">Arama Sonuçları:</span>
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectLocation(r)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-zinc-950 hover:bg-orange-600/20 border border-zinc-800 text-xs text-zinc-200 hover:text-white flex items-center justify-between transition"
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="text-orange-400 text-[10px]">Seç →</span>
                  </button>
                ))}
              </div>
            )}

            {/* Popular Presets with Trabzon Yomra First */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold">Hızlı Seçim:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {POPULAR_LOCATIONS.map((loc, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectLocation(loc)}
                    className={`px-2.5 py-2 rounded-xl border text-xs text-left truncate transition ${
                      weather.locationName.includes(loc.name.split(',')[0])
                        ? 'bg-orange-600/20 border-orange-500 text-orange-400 font-bold'
                        : 'bg-zinc-950/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    📍 {loc.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Weather Card */}
      <div className="bg-gradient-to-r from-zinc-900/95 via-zinc-900/85 to-zinc-950/95 p-2.5 rounded-2xl border border-zinc-800/90 shadow-xl space-y-2 backdrop-blur-md">
        {/* Top Location & Update Time Header */}
        <div className="flex items-center justify-between text-[11px] border-b border-zinc-800/60 pb-1.5">
          {/* Clickable Location to Change City/District */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-orange-400 font-medium truncate max-w-[70%] transition text-left group"
            title="Konumu Değiştirmek İçin Dokunun"
          >
            <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="truncate underline decoration-zinc-700 decoration-dotted group-hover:decoration-orange-500">
              {weather.locationName}
            </span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-500" />
              {weather.updatedAt}
            </span>
            <button
              onClick={() => fetchWeather(true)}
              disabled={isRefreshing}
              className="p-1 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-zinc-800/80 transition active:scale-95 disabled:opacity-50"
              title="Hava Durumunu Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Main Weather Metrics Row */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Temperature & Day/Night Condition Icon */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              {weather.condition.includes('Fırtına') ? (
                <CloudLightning className="w-5 h-5 text-amber-400 animate-pulse" />
              ) : weather.condition.includes('Yağmur') ? (
                <CloudRain className="w-5 h-5 text-sky-400" />
              ) : weather.condition.includes('Kar') ? (
                <Snowflake className="w-5 h-5 text-sky-300" />
              ) : weather.condition.includes('Sis') ? (
                <CloudFog className="w-5 h-5 text-zinc-400" />
              ) : weather.isDay ? (
                weather.condition.includes('Bulut') ? (
                  <CloudSun className="w-5 h-5 text-orange-400" />
                ) : (
                  <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />
                )
              ) : weather.condition.includes('Bulut') ? (
                <CloudMoon className="w-5 h-5 text-sky-300" />
              ) : (
                <Moon className="w-5 h-5 text-sky-200" />
              )}
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold font-mono text-white leading-none">
                  {weather.temp}°
                </span>
                <span className="text-[10px] text-zinc-400 font-bold uppercase">C</span>
              </div>
              <div className="text-[11px] font-semibold text-zinc-300 uppercase tracking-tight mt-0.5">
                {weather.condition}
              </div>
            </div>
          </div>

          {/* Right: Wind & Humidity Chips */}
          <div className="flex items-center gap-2 text-zinc-300 font-mono text-xs">
            <div className="flex flex-col items-center bg-zinc-950/80 px-2 py-1 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-1 text-zinc-400">
                <Wind className="w-3 h-3 text-sky-400" />
                <span className="text-[9px] uppercase">Rüzgar</span>
              </div>
              <span className="font-bold text-white text-[11px] mt-0.5">{weather.wind} km/s</span>
            </div>

            <div className="flex flex-col items-center bg-zinc-950/80 px-2 py-1 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-1 text-zinc-400">
                <Droplets className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] uppercase">Nem</span>
              </div>
              <span className="font-bold text-white text-[11px] mt-0.5">%{weather.humidity}</span>
            </div>
          </div>
        </div>

        {/* Riding Safety Assessment Pill */}
        <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-zinc-950/90 border border-zinc-800/80 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              weather.ridingSafety.status === 'good'
                ? 'bg-emerald-400 animate-pulse'
                : weather.ridingSafety.status === 'caution'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-red-500 animate-ping'
            }`} />
            <span className={`font-semibold ${
              weather.ridingSafety.status === 'good'
                ? 'text-emerald-400'
                : weather.ridingSafety.status === 'caution'
                ? 'text-amber-400'
                : 'text-red-400'
            }`}>
              {weather.ridingSafety.text}
            </span>
          </div>

          <span className="text-zinc-500 text-[9px]">
            {weather.isDay ? '☀️ Gündüz Sürüşü' : '🌙 Gece Sürüşü'}
          </span>
        </div>
      </div>
    </>
  );
};
