import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-MX").format(value);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}
