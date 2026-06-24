import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  const safeValue = Number(value ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(safeValue);
}

export const decimalParaHora = (decimal: number | string | null | undefined) => {
  const valor = Number(decimal || 0);
  let horas = Math.floor(valor);
  let minutos = Math.round((valor - horas) * 60);

  if (minutos >= 60) {
    horas += Math.floor(minutos / 60);
    minutos = minutos % 60;
  }

  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
};
