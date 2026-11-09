import React from 'react';

interface AiOrbProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isThinking?: boolean;
  className?: string;
}

export const AiOrb: React.FC<AiOrbProps> = ({
  size = 'md',
  isThinking = false,
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-10 h-10',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
    xl: 'w-36 h-36',
  };

  const orbDimensions = sizeMap[size];

  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      {/* Ambient background bloom */}
      <div
        className={`absolute rounded-full blur-2xl transition-all duration-700 ${
          isThinking
            ? 'w-48 h-48 bg-linear-to-tr from-violet-600/60 via-fuchsia-500/50 to-indigo-500/60 animate-orb-pulse'
            : 'w-36 h-36 bg-linear-to-tr from-violet-500/35 via-indigo-400/30 to-pink-400/25 dark:from-violet-600/40 dark:via-indigo-500/30 dark:to-pink-500/30'
        }`}
      />

      {/* Primary Luminous Iridescent Sphere (Inspiration PDF Pages 3, 5, 12, 13) */}
      <div
        className={`relative ${orbDimensions} rounded-full overflow-hidden transition-all duration-500 animate-orb-float shadow-2xl`}
        style={{
          background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #e0e7ff 15%, #c084fc 45%, #818cf8 70%, #4f46e5 90%, #312e81 100%)',
          boxShadow: 'inset -6px -8px 18px rgba(30, 27, 75, 0.65), inset 4px 6px 14px rgba(255, 255, 255, 0.95), 0 16px 40px -10px rgba(124, 58, 237, 0.45)',
        }}
      >
        {/* Soft internal swirling overlay */}
        <div
          className={`absolute inset-0 rounded-full mix-blend-overlay opacity-80 ${
            isThinking ? 'animate-spin' : ''
          }`}
          style={{
            background: 'radial-gradient(circle at 70% 65%, rgba(244, 114, 182, 0.7) 0%, rgba(167, 139, 250, 0.5) 40%, transparent 75%)',
            animationDuration: '8s',
          }}
        />

        {/* Specular gleam highlight */}
        <div
          className="absolute top-1 left-2.5 w-1/3 h-1/4 rounded-full opacity-70"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 100%)',
            transform: 'rotate(-25deg)',
          }}
        />
      </div>
    </div>
  );
};
