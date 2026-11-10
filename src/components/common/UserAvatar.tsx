import React, { useState } from 'react';
import { User } from '../../types';

export interface UserAvatarProps {
  user: User;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showAnimationRing?: boolean;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export const ANIMATED_AVATAR_PRESETS = [
  {
    id: 'orbit-core',
    name: 'Orbit Core',
    description: 'Pulsing quantum core with dual planetary orbits and holographic particle flares',
    url: '/assets/avatars/orbit-core.svg',
    category: 'Cosmic',
  },
  {
    id: 'cyber-pulse',
    name: 'Cyber Pulse',
    description: 'Neon cyberpunk hexagon forcefield with counter-rotating shields and laser nodes',
    url: '/assets/avatars/cyber-pulse.svg',
    category: 'Cyber',
  },
  {
    id: 'aurora-flow',
    name: 'Aurora Flow',
    description: 'Fluid morphing liquid aurora wave with shifting emerald and violet gradients',
    url: '/assets/avatars/aurora-flow.svg',
    category: 'Fluid',
  },
  {
    id: 'quantum-sphere',
    name: 'Quantum Sphere',
    description: 'Rotating 3D wireframe quantum sphere with oscillating orbital meridian rings',
    url: '/assets/avatars/quantum-sphere.svg',
    category: 'Sci-Fi',
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    description: 'Radiating coronal loop plasma with pulsing golden solar flare core',
    url: '/assets/avatars/solar-flare.svg',
    category: 'Solar',
  },
];

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-14 h-14 text-base',
  '2xl': 'w-24 h-24 text-xl',
};

const ringSizeMap = {
  xs: 'p-0.5',
  sm: 'p-0.5',
  md: 'p-0.5',
  lg: 'p-1',
  xl: 'p-1.5',
  '2xl': 'p-2',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  showAnimationRing = true,
  className = '',
  onClick,
  title,
}) => {
  const [hasError, setHasError] = useState(false);

  // Check if avatar is an animated image (.svg, .gif, or webp)
  const isAnimated =
    user.avatarUrl?.includes('.svg') ||
    user.avatarUrl?.includes('.gif') ||
    user.avatarAnimation && user.avatarAnimation !== 'none';

  const animStyle = user.avatarAnimation || (isAnimated ? 'glow' : 'none');

  let animationClass = '';
  if (showAnimationRing && animStyle !== 'none') {
    switch (animStyle) {
      case 'pulse':
        animationClass = 'animate-pulse ring-2 ring-indigo-500/80 shadow-lg shadow-indigo-500/20';
        break;
      case 'glow':
        animationClass = 'ring-2 ring-cyan-400/80 shadow-lg shadow-cyan-500/30';
        break;
      case 'spin':
        animationClass = 'ring-2 ring-indigo-500 shadow-md shadow-indigo-500/20';
        break;
      case 'orbit':
        animationClass = 'ring-2 ring-purple-500/80 shadow-lg shadow-purple-500/25';
        break;
      case 'wave':
        animationClass = 'ring-2 ring-emerald-500/80 shadow-lg shadow-emerald-500/20';
        break;
      default:
        animationClass = 'ring-1 ring-slate-300 dark:ring-neutral-700';
    }
  } else {
    animationClass = 'ring-1 ring-slate-300 dark:ring-neutral-700';
  }

  return (
    <div
      onClick={onClick}
      title={title || user.name}
      className={`relative inline-flex items-center justify-center shrink-0 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Animated Subtle Ambient Ring */}
      {showAnimationRing && animStyle !== 'none' && (
        <span
          className={`absolute inset-0 rounded-full bg-linear-to-tr from-indigo-500 via-cyan-400 to-purple-500 opacity-60 blur-xs ${ringSizeMap[size]} animate-spin duration-10000`}
        />
      )}

      {/* Main Avatar Element */}
      <div
        className={`relative rounded-full overflow-hidden flex items-center justify-center bg-slate-900 ${
          sizeMap[size]
        } ${animationClass} transition-all duration-300`}
      >
        {!hasError && user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            onError={() => setHasError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover select-none"
          />
        ) : (
          <span className="font-semibold text-slate-200 tracking-wider">
            {user.initials || (user.name ? user.name.slice(0, 2).toUpperCase() : 'OR')}
          </span>
        )}
      </div>

      {/* Live Active Status Indicator Dot */}
      {size !== 'xs' && (
        <span className="absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-950 animate-pulse" />
      )}
    </div>
  );
};
