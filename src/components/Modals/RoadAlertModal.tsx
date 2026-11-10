import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface RoadAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendAlert: (alert: string) => void;
}

export const RoadAlertModal: React.FC<RoadAlertModalProps> = ({
  isOpen,
  onClose,
  onSendAlert,
}) => {
  if (!isOpen) return null;

  const alerts = [
    { icon: '🚓', text: 'Radar Var!' },
    { icon: '🚧', text: 'Yol Çalışması' },
    { icon: '⚠️', text: 'Kaza/Engel' },
    { icon: '⛽', text: 'Benzin İstasyonu' },
    { icon: '🛣️', text: 'Yol Kaygan' },
    { icon: '🛑', text: 'Kritik Dur/Bekle' },
  ];

  return (
    <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="text-orange-500" /> Yol İkazı
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {alerts.map((alert) => (
            <button
              key={alert.text}
              onClick={() => {
                onSendAlert(alert.icon + ' ' + alert.text);
                onClose();
              }}
              className="bg-zinc-800 hover:bg-zinc-700 p-4 rounded-xl flex flex-col items-center gap-2 transition"
            >
              <span className="text-3xl">{alert.icon}</span>
              <span className="text-xs font-bold text-white text-center">{alert.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
