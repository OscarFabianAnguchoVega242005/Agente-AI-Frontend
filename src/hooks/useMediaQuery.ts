import { useSyncExternalStore } from 'react';

/** true mientras la media query se cumple (se actualiza al girar el móvil o cambiar el tamaño de la ventana). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Pantalla táctil como puntero principal (móviles y tablets). */
export const COARSE_POINTER = '(pointer: coarse)';
