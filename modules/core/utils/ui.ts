import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind evitando conflictos
 * (ej: si pasas 'p-4' y 'p-2', dejará solo la última).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
