import { cn } from "@/lib/utils";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type StatusVariant =
    | "recebido"
    | "em_validacao"
    | "processado"
    | "aguardando_financeiro"
    | "pago"
    | "lancado"
    | "validado"
    | "fechado"
    | "enviado_banco"
    | "inconsistente"
    | "pendente"
    | "atrasado"
    | "ok"
    | "ajustado";

// ─── Mapa de estilo ───────────────────────────────────────────────────────────

const variantStyles: Record<StatusVariant, { bg: string; text: string; label: string }> = {
    recebido: { bg: "bg-[#FEF9C3]", text: "text-[#A16207]", label: "Recebido" },
    em_validacao: { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]", label: "Em Validação RH" },
    processado: { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]", label: "Processado" },
    aguardando_financeiro: { bg: "bg-[#FEF9C3]", text: "text-[#A16207]", label: "Aguard. Financeiro" },
    pago: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", label: "Pago" },
    lancado: { bg: "bg-[#FEF9C3]", text: "text-[#A16207]", label: "Lançado" },
    validado: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", label: "Validado" },
    fechado: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", label: "Fechado" },
    enviado_banco: { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]", label: "Enviado ao Banco" },
    inconsistente: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]", label: "Inconsistente" },
    pendente: { bg: "bg-[#FEF9C3]", text: "text-[#A16207]", label: "Pendente" },
    atrasado: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]", label: "Atrasado" },
    ok: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", label: "OK" },
    ajustado: { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]", label: "Ajustado" },
};

// ─── Componente ──────────────────────────────────────────────────────────────

interface StatusBadgeProps {
    variant: StatusVariant;
    label?: string;        // sobrescreve o label padrão se necessário
    className?: string;
    dot?: boolean;         // exibe ponto colorido antes do texto
}

export const StatusBadge = ({ variant, label, className, dot }: StatusBadgeProps) => {
    const style = variantStyles[variant] ?? variantStyles.pendente;
    const displayLabel = label ?? style.label;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-[6px] px-2 py-0.5",
                "font-body font-medium text-[12px] whitespace-nowrap",
                style.bg,
                style.text,
                className
            )}
        >
            {dot && (
                <span
                    className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", style.text)}
                    style={{ backgroundColor: "currentColor" }}
                />
            )}
            {displayLabel}
        </span>
    );
};

// ─── Helper para status de string ────────────────────────────────────────────

/** Converte uma string de status do banco para StatusVariant */
export const toStatusVariant = (status: string | null | undefined): StatusVariant => {
    if (!status) return "pendente";
    const map: Record<string, StatusVariant> = {
        recebido: "recebido",
        em_validacao: "em_validacao",
        validacao: "em_validacao",
        processado: "processado",
        aguardando_financeiro: "aguardando_financeiro",
        pago: "pago",
        lancado: "lancado",
        validado: "validado",
        fechado: "fechado",
        enviado_banco: "enviado_banco",
        inconsistente: "inconsistente",
        pendente: "pendente",
        atrasado: "atrasado",
        ok: "ok",
        ajustado: "ajustado",
        // aliases comuns
        approved: "validado",
        paid: "pago",
        pending: "pendente",
        error: "inconsistente",
        closed: "fechado",
    };
    return map[status.toLowerCase()] ?? "pendente";
};
