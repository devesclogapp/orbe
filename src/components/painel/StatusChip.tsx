import { cn } from "@/lib/utils";

type Status =
  | "ok"
  | "inconsistente"
  | "ajustado"
  | "pendente"
  | "incompleto"
  | "positivo"
  | "critico"
  | "saldo_positivo"
  | "debito_leve"
  | "debito_critico"
  | "horas_a_vencer"
  | "excesso_banco"
  | "aguardando_rh"
  | "em_analise"
  | "pago"
  | "compensado"
  | "folga_lancada"
  | "vencido"
  | "proximo_vencimento"
  | "dados_completos";

const styles: Record<Status, string> = {
  ok: "bg-success-soft text-success-strong",
  positivo: "bg-success-soft text-success-strong",
  inconsistente: "bg-destructive-soft text-destructive-strong",
  critico: "bg-destructive-soft text-destructive-strong",
  ajustado: "bg-info-soft text-info",
  pendente: "bg-warning-soft text-warning-strong",
  incompleto: "bg-warning-soft text-warning-strong",
  saldo_positivo: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  debito_leve: "border border-amber-200 bg-amber-50 text-amber-700",
  debito_critico: "border border-rose-300 bg-rose-100 text-rose-800 shadow-sm",
  horas_a_vencer: "border border-orange-200 bg-orange-50 text-orange-700",
  excesso_banco: "border border-sky-200 bg-sky-50 text-sky-700",
  aguardando_rh: "border border-violet-200 bg-violet-50 text-violet-700",
  em_analise: "border border-slate-200 bg-slate-100 text-slate-700",
  pago: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  compensado: "border border-cyan-200 bg-cyan-50 text-cyan-700",
  folga_lancada: "border border-indigo-200 bg-indigo-50 text-indigo-700",
  vencido: "border border-rose-300 bg-rose-100 text-rose-800",
  proximo_vencimento: "border border-amber-200 bg-amber-50 text-amber-700",
  dados_completos: "border border-emerald-300 bg-emerald-100 text-emerald-800 font-semibold",
};

const labels: Record<Status, string> = {
  ok: "OK",
  positivo: "Saldo Positivo",
  inconsistente: "Inconsistencia",
  critico: "Critico",
  ajustado: "Ajustado",
  pendente: "Pendente",
  incompleto: "Incompleto",
  saldo_positivo: "Saldo Positivo",
  debito_leve: "Debito Leve",
  debito_critico: "Debito Critico",
  horas_a_vencer: "Horas a vencer",
  excesso_banco: "Excesso de banco",
  aguardando_rh: "Aguardando acao RH",
  em_analise: "Em analise",
  pago: "Pago",
  compensado: "Compensado",
  folga_lancada: "Folga lancada",
  vencido: "Vencido",
  proximo_vencimento: "Proximo do vencimento",
  dados_completos: "Dados completos",
};

export const StatusChip = ({ status, label }: { status: Status; label?: string }) => (
  <span className={cn("esc-chip", styles[status])}>{label ?? labels[status]}</span>
);
