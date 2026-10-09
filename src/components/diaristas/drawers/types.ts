export const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export const STATUS_DIARISTA_MAP: Record<string, { label: string; cls: string; opacity: string }> = {
    em_aberto: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-100" },
    EM_ABERTO: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-100" },
    AGUARDANDO_VALIDACAO_RH: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-[0.95]" },
    VALIDADO_RH: { label: "🟢 Validado RH", cls: "bg-cyan-50 text-cyan-600 border-cyan-100", opacity: "opacity-[0.95]" },
    FECHADO_FINANCEIRO: { label: "🔵 Financeiro", cls: "bg-emerald-50 text-emerald-600 border-emerald-100", opacity: "opacity-[0.90]" },
    AGUARDANDO_FINANCEIRO: { label: "🔵 Financeiro", cls: "bg-emerald-50 text-emerald-600 border-emerald-100", opacity: "opacity-[0.90]" },
    CNAB_GERADO: { label: "🟣 CNAB Gerado", cls: "bg-indigo-50 text-indigo-600 border-indigo-100", opacity: "opacity-[0.80]" },
    PAGO: { label: "💰 Pago", cls: "bg-blue-50 text-blue-600 border-blue-100", opacity: "opacity-[0.70]" },
    DEVOLVIDO: { label: "Devolvido", cls: "bg-rose-50 text-rose-600 border-rose-100", opacity: "opacity-100" },
    cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground", opacity: "opacity-100" },
    CANCELADO: { label: "Cancelado", cls: "bg-muted text-muted-foreground", opacity: "opacity-100" },
    fechado_para_pagamento: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-100" },
    fechado: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-100" },
    CONCLUIDO: { label: "⚫ Concluído", cls: "bg-zinc-100 text-zinc-500 border-zinc-200", opacity: "opacity-[0.60]" },
};
