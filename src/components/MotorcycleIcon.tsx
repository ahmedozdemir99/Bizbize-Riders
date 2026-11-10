import React from 'react';

interface MotorcycleIconProps {
  className?: string;
}

export const MotorcycleIcon: React.FC<MotorcycleIconProps> = ({ className = 'w-6 h-6' }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="5" cy="18" r="3" />
      <circle cx="19" cy="18" r="3" />
      <path d="M10 18h4l2-5h-4l-1-2h4l2-5h-6" />
    </svg>
  );
};
