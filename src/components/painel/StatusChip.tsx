import { cn } from "@/lib/utils";

type Status = "ok" | "inconsistente" | "ajustado" | "pendente" | "incompleto";

const styles: Record<Status, string> = {
  ok: "bg-success-soft text-success-strong",
  inconsistente: "bg-destructive-soft text-destructive-strong",
  ajustado: "bg-info-soft text-info",
  pendente: "bg-warning-soft text-warning-strong",
  incompleto: "bg-warning-soft text-warning-strong",
};

const labels: Record<Status, string> = {
  ok: "OK",
  inconsistente: "Inconsistência",
  ajustado: "Ajustado",
  pendente: "Pendente",
  incompleto: "Incompleto",
};

export const StatusChip = ({ status, label }: { status: Status; label?: string }) => (
  <span className={cn("esc-chip", styles[status])}>{label ?? labels[status]}</span>
);
