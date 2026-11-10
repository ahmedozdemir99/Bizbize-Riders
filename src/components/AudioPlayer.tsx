import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatSecs = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 bg-zinc-900/90 border border-zinc-700/80 rounded-2xl p-2.5 max-w-xs sm:max-w-sm">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-xl bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-md transition active:scale-95"
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1 h-5 mb-1 px-1">
          {[40, 75, 30, 90, 50, 80, 45, 100, 60, 35, 70, 85, 40, 65].map((height, i) => {
            const progressRatio = duration > 0 ? currentTime / duration : 0;
            const barRatio = i / 14;
            const isActive = barRatio <= progressRatio;

            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-all duration-300 ${
                  isActive ? 'bg-orange-500' : 'bg-zinc-700'
                } ${isPlaying ? 'animate-bounce' : ''}`}
                style={{ 
                  height: `${Math.max(4, (height / 100) * 18)}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.6s'
                }}
              />
            );
          })}
        </div>

        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />

        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mt-1">
          <span>{formatSecs(currentTime)}</span>
          <span className="flex items-center gap-1 text-zinc-500">
            <Volume2 className="w-3 h-3 text-orange-400" />
            {formatSecs(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};
