import React from 'react';

interface MotorcycleIconProps {
  className?: string;
  fill?: string;
}

export const MotorcycleIcon: React.FC<MotorcycleIconProps> = ({ 
  className = 'w-6 h-6',
  fill = 'currentColor'
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill={fill}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Rear Wheel: Outer Tire, Hub, and Rim */}
      <path d="M 21.5 50.8 C 11.2 50.8 2.8 59.2 2.8 69.5 C 2.8 79.8 11.2 88.2 21.5 88.2 C 31.8 88.2 40.2 79.8 40.2 69.5 C 40.2 59.2 31.8 50.8 21.5 50.8 Z M 21.5 80.5 C 15.4 80.5 10.5 75.6 10.5 69.5 C 10.5 63.4 15.4 58.5 21.5 58.5 C 27.6 58.5 32.5 63.4 32.5 69.5 C 32.5 75.6 27.6 80.5 21.5 80.5 Z" />
      <circle cx="21.5" cy="69.5" r="4.2" />

      {/* Front Wheel: Outer Tire, Hub, and Rim */}
      <path d="M 78.5 50.8 C 68.2 50.8 59.8 59.2 59.8 69.5 C 59.8 79.8 68.2 88.2 78.5 88.2 C 88.8 88.2 97.2 79.8 97.2 69.5 C 97.2 59.2 88.8 50.8 78.5 50.8 Z M 78.5 80.5 C 72.4 80.5 67.5 75.6 67.5 69.5 C 67.5 63.4 72.4 58.5 78.5 58.5 C 84.6 58.5 89.5 63.4 89.5 69.5 C 89.5 75.6 84.6 80.5 78.5 80.5 Z" />
      <circle cx="78.5" cy="69.5" r="4.2" />

      {/* Motorcycle Body: Muscular Tank, Frame, Engine Block, Swingarm, Handlebars & Headlight Cowl */}
      <path d="
        M 62.5 24.2
        C 61.2 23.5 60.5 24.8 60.8 26.5
        C 61.5 28.2 63.8 29.5 66.5 29.8
        L 69.5 32.2
        L 59.2 32.5
        C 58.2 32.5 58.2 34.8 59.5 34.8
        L 68.2 34.8
        L 67.2 37.5
        C 65.5 36.8 61.2 36.2 57.5 37.8
        C 53.5 39.5 48.8 45.5 44.5 45.8
        C 40.2 46.2 33.5 44.2 29.5 44.8
        C 25.2 45.5 15.2 46.5 11.5 48.2
        C 9.8 49.0 8.2 50.5 4.8 53.8
        L 7.8 54.2
        L 14.8 48.8
        L 18.5 55.2
        C 20.8 53.2 23.8 52.0 27.2 51.5
        L 32.8 51.5
        L 41.5 61.8
        L 43.8 58.2
        C 41.2 55.5 44.5 51.2 48.2 47.8
        C 51.8 44.5 63.5 36.5 67.8 38.5
        L 72.5 34.2
        C 73.2 35.8 74.8 37.5 77.2 38.5
        C 80.5 40.0 82.8 43.5 83.2 46.8
        C 83.5 49.2 81.2 50.5 76.5 51.2
        L 77.8 54.2
        C 81.5 53.5 84.8 51.8 85.2 46.5
        C 85.5 41.2 83.2 36.5 78.8 34.5
        C 76.2 33.2 73.5 32.8 71.8 28.5
        C 70.8 25.5 67.2 23.2 62.5 24.2
        Z
      " />

      {/* Engine Crankcase, Exhaust Pipe & Lower Structure */}
      <path d="
        M 42.5 63.2
        L 34.5 68.5
        C 31.8 67.8 28.5 66.8 27.8 64.2
        L 39.5 53.2
        L 46.2 60.5
        Z
      " />

      {/* Engine Cooling Fins & Clutch Cover Detail */}
      <path d="
        M 52.5 53.2 H 60.2 V 55.8 H 52.5 Z
        M 52.0 57.5 H 60.2 V 60.2 H 52.0 Z
        M 51.5 61.8 H 59.8 V 64.5 H 51.5 Z
      " />
      <circle cx="53.5" cy="69.5" r="5.2" />

      {/* Upswept Sport Exhaust Muffler */}
      <path d="
        M 28.5 69.5
        L 39.5 68.8
        L 44.8 74.5
        L 62.5 71.5
        C 63.8 69.5 63.2 65.5 61.5 64.5
        L 57.5 71.2
        L 44.2 73.2
        L 38.5 68.2
        L 28.5 69.5
        Z
      " />

      {/* Front Telescopic Fork & Triple Clamp */}
      <path d="
        M 71.5 39.2
        L 77.2 69.5
        L 79.5 69.5
        L 74.2 39.2
        Z
      " />
    </svg>
  );
};
