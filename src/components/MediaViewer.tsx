import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface MediaViewerProps {
  url: string | null;
  type: 'image' | 'video' | null;
  filename?: string | null;
  onClose: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ url, type, filename, onClose }) => {
  if (!url || !type) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
      {/* Top Controls Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
        <span className="text-sm font-semibold truncate max-w-[60%] text-zinc-300">
          {filename || (type === 'image' ? 'Fotoğraf' : 'Video')}
        </span>

        <div className="flex items-center gap-2">
          <a
            href={url}
            download={filename || `rider_media.${type === 'image' ? 'png' : 'mp4'}`}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition active:scale-95"
            title="İndir"
          >
            <Download className="w-5 h-5" />
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition active:scale-95"
            title="Yeni Sekmede Aç"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white transition active:scale-95"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl max-h-[85vh] w-full flex items-center justify-center p-2">
        {type === 'image' ? (
          <img
            src={url}
            alt={filename || 'Medya'}
            className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-zinc-800"
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl border border-zinc-800"
          />
        )}
      </div>
    </div>
  );
};
