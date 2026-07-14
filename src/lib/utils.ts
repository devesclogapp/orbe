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

export function validarCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, "");
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  let split = cpf.split("");
  let v1 = 0;
  let v2 = 0;
  for (let i = 0; i < 9; i++) {
    v1 += parseInt(split[i]) * (10 - i);
    v2 += parseInt(split[i]) * (11 - i);
  }
  v1 = (v1 * 10) % 11;
  v1 = v1 >= 10 ? 0 : v1;
  v2 += v1 * 2;
  v2 = (v2 * 10) % 11;
  v2 = v2 >= 10 ? 0 : v2;
  return v1 === parseInt(split[9]) && v2 === parseInt(split[10]);
}
