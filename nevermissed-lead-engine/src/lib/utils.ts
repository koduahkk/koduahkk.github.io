import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function appUrl(path = "") {
  // On Vercel, fall back to the deployment's own domain when APP_URL isn't set.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
  return base + path;
}

export function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}
