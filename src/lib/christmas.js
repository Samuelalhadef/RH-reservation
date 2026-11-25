'use client';

import { useEffect, useState } from 'react';

// Thème de Noël : actif automatiquement du 25 novembre au 6 janvier (Épiphanie).
// Chaque agent peut le couper (préférence mémorisée dans le navigateur).
const STORAGE_KEY = 'theme-noel';
const EVENT = 'theme-noel-change';

export function isChristmasSeason(date = new Date()) {
  const m = date.getMonth();
  const d = date.getDate();
  return m === 11 || (m === 10 && d >= 25) || (m === 0 && d <= 6);
}

function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setChristmasEnabled(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/**
 * { season, enabled, active } — calculé après le montage pour éviter tout
 * décalage d'hydratation entre le rendu serveur et le navigateur.
 */
export function useChristmas() {
  const [state, setState] = useState({ season: false, enabled: true, active: false });

  useEffect(() => {
    const update = () => {
      const season = isChristmasSeason();
      const enabled = readEnabled();
      setState({ season, enabled, active: season && enabled });
    };
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return state;
}
