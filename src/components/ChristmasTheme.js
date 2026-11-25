'use client';

import { useMemo } from 'react';
import { useChristmas, setChristmasEnabled } from '@/lib/christmas';

// Flocons générés une fois, de façon déterministe (pas de Math.random au rendu).
function makeFlakes(count) {
  const flakes = [];
  for (let i = 0; i < count; i++) {
    const r = (n) => ((i * 9301 + n * 49297) % 233280) / 233280;
    flakes.push({
      left: r(1) * 100,
      size: 4 + r(2) * 8,
      duration: 9 + r(3) * 12,
      delay: -r(4) * 20,
      drift: (r(5) - 0.5) * 80,
      opacity: 0.45 + r(6) * 0.5,
    });
  }
  return flakes;
}

/** Neige qui tombe + bouton pour activer/couper le thème. Monté une fois dans le layout. */
export default function ChristmasTheme() {
  const { season, active } = useChristmas();
  const flakes = useMemo(() => makeFlakes(36), []);

  if (!season) return null;

  return (
    <>
      {active && (
        <div className="noel-snow" aria-hidden="true">
          {flakes.map((f, i) => (
            <span
              key={i}
              className="noel-flake"
              style={{
                left: `${f.left}%`,
                width: f.size,
                height: f.size,
                opacity: f.opacity,
                animationDuration: `${f.duration}s`,
                animationDelay: `${f.delay}s`,
                '--drift': `${f.drift}px`,
              }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setChristmasEnabled(!active)}
        className="fixed bottom-4 left-4 z-40 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg ring-1 ring-gray-200 flex items-center justify-center text-lg hover:scale-110 transition print:hidden"
        title={active ? 'Désactiver le thème de Noël' : 'Activer le thème de Noël'}
        aria-label={active ? 'Désactiver le thème de Noël' : 'Activer le thème de Noël'}
      >
        <span className={active ? '' : 'grayscale opacity-60'}>{active ? '❄️' : '🎄'}</span>
      </button>
    </>
  );
}

/** Guirlande lumineuse, à placer en bas d'un conteneur `relative`. */
export function ChristmasGarland() {
  const { active } = useChristmas();
  if (!active) return null;
  const colors = ['#ef4444', '#facc15', '#22c55e', '#3b82f6'];
  return (
    <div className="noel-garland" aria-hidden="true">
      <svg className="absolute inset-x-0 top-0 w-full h-3" preserveAspectRatio="none" viewBox="0 0 100 10">
        <path d="M0 2 Q 2.5 7 5 2 T 10 2 T 15 2 T 20 2 T 25 2 T 30 2 T 35 2 T 40 2 T 45 2 T 50 2 T 55 2 T 60 2 T 65 2 T 70 2 T 75 2 T 80 2 T 85 2 T 90 2 T 95 2 T 100 2" fill="none" stroke="#166534" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: 20 }, (_, i) => (
        <span
          key={i}
          className="noel-bulb"
          style={{
            left: `${2.5 + i * 5}%`,
            background: colors[i % colors.length],
            color: colors[i % colors.length],
            animationDelay: `${(i % 4) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Bonnet de Noël posé sur un logo (parent en `relative`). */
export function ChristmasHat({ className = '' }) {
  const { active } = useChristmas();
  if (!active) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 48"
      className={`absolute pointer-events-none z-10 drop-shadow ${className}`}
    >
      <path d="M8 38 C 14 14, 34 2, 52 10 C 46 14, 44 24, 46 36 Z" fill="#dc2626" />
      <path d="M52 10 C 56 12, 58 18, 57 24" fill="none" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
      <circle cx="57" cy="26" r="5.5" fill="#fff" />
      <rect x="4" y="34" width="46" height="10" rx="5" fill="#fff" />
    </svg>
  );
}

/** Petit message de fêtes (null hors saison ou thème coupé). */
export function ChristmasGreeting({ className = '' }) {
  const { active } = useChristmas();
  if (!active) return null;
  const now = new Date();
  const text = now.getMonth() === 0 || now.getDate() > 25 ? 'Bonne année ✨' : 'Joyeuses fêtes 🎄';
  return <span className={className}>{text}</span>;
}
