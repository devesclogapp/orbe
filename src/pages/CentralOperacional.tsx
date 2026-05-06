import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Clock, UserCheck, Scale, Wallet, AlertTriangle, CheckCircle2, ArrowRight, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";
import { AppShell } from "@/components/layout/AppShell";

// ─── KPI card ────────────────────────────────────────────────────────────────

const PipelineCard = ({
  icon: Icon,
  label,
  count,
  sublabel,
  color,
  onClick,
}: {
  icon: any;
  label: string;
  count: number | null;
  sublabel: string;
  color: "orange" | "blue" | "green" | "yellow" | "red";
  onClick: () => void;
}) => {
  const colorMap = {
    orange: { bg: "bg-[#FFF1EC]", icon: "text-[#FD4C00]" },
    blue: { bg: "bg-[#DBEAFE]", icon: "text-[#2563EB]" },
    green: { bg: "bg-[#DCFCE7]", icon: "text-[#15803D]" },
    yellow: { bg: "bg-[#FEF9C3]", icon: "text-[#A16207]" },
    red: { bg: "bg-[#FEE2E2]", icon: "text-[#B91C1C]" },
  };
  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-[#DEDEDE] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-[#C4C4C4] hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`h-10 w-10 rounded-lg ${c.bg} border border-black/5 flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${c.icon}`} strokeWidth={1.75} />
        </div>
        <ArrowRight className="h-4 w-4 text-[#A3A3A3] group-hover:text-[#4D4D4D] group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="font-display font-bold text-[28px] text-[#171717] leading-none mb-1">
        {count === null ? "—" : count}
      </div>
      <div className="font-display font-medium text-[14px] text-[#4D4D4D] mb-0.5">{label}</div>
      <div className="font-body text-[12px] text-[#737373]">{sublabel}</div>
    </button>
  );
};

// ─── Pipeline step ────────────────────────────────────────────────────────────

const FlowStep = ({ step, label, active, done }: { step: number; label: string; active?: boolean; done?: boolean }) => (
  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-display font-bold transition-colors flex-shrink-0 ${done ? "bg-[#DCFCE7] text-[#15803D]" : active ? "bg-[#FD4C00] text-white" : "bg-[#EBEBEB] text-[#A3A3A3]"
      }`}>
      {done ? <CheckCircle2 className="h-4 w-4" /> : step}
    </div>
    <span className={`text-[10px] font-body text-center leading-tight ${done ? "text-[#15803D]" : active ? "text-[#FD4C00] font-medium" : "text-[#A3A3A3]"
      }`}>
      {label}
    </span>
  </div>
);

// ─── Página ───────────────────────────────────────────────────────────────────

const CentralOperacional = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();

  const { data: opCount } = useQuery({
    queryKey: ["central-op-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("operacoes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!);
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  const { data: pontoCount } = useQuery({
    queryKey: ["central-ponto-count", tenantId],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from("registros_ponto")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .gte("created_at", hoje);
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  const { data: diaristasCount } = useQuery({
    queryKey: ["central-diaristas-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("diaristas_lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("status", "pendente");
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  const { data: fechamentoCount } = useQuery({
    queryKey: ["central-fechamento-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("fechamentos")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("status", "pendente");
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  const { data: bhCount } = useQuery({
    queryKey: ["central-bh-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("banco_horas_saldo")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .lt("saldo_minutos", -60);
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const hasAlerts = (diaristasCount ?? 0) > 0 || (bhCount ?? 0) > 0;

  return (
    <AppShell title="Central Operacional" subtitle={today}>
      <div className="space-y-8 max-w-[1100px]">
        {/* Cabeçalho */}
        <div>
          <h1 className="font-display font-bold text-[24px] text-[#171717]">Central Operacional</h1>
          <p className="font-body text-[14px] text-[#737373] mt-1 capitalize">{today}</p>
        </div>

        {/* Pipeline visual */}
        <div className="bg-white border border-[#DEDEDE] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <h2 className="font-display font-semibold text-[18px] text-[#171717] mb-6">Pipeline de Processamento</h2>
          <div className="flex items-start gap-1">
            <FlowStep step={1} label={"INPUT\nExterno"} done />
            <div className="flex items-center pb-5"><ArrowRight className="h-3 w-3 text-[#C4C4C4]" /></div>
            <FlowStep step={2} label={"Entradas\nOperacionais"} active />
            <div className="flex items-center pb-5"><ArrowRight className="h-3 w-3 text-[#C4C4C4]" /></div>
            <FlowStep step={3} label={"Processamento\nRH"} />
            <div className="flex items-center pb-5"><ArrowRight className="h-3 w-3 text-[#C4C4C4]" /></div>
            <FlowStep step={4} label={"Fechamento"} />
            <div className="flex items-center pb-5"><ArrowRight className="h-3 w-3 text-[#C4C4C4]" /></div>
            <FlowStep step={5} label={"Financeiro"} />
            <div className="flex items-center pb-5"><ArrowRight className="h-3 w-3 text-[#C4C4C4]" /></div>
            <FlowStep step={6} label={"Relatórios"} />
          </div>
          <p className="font-body text-[11px] text-[#A3A3A3] mt-3">
            INPUT → PROCESSAMENTO → FECHAMENTO → PAGAMENTO → RELATÓRIOS
          </p>
        </div>

        {/* Alertas */}
        {hasAlerts && (
          <div className="bg-[#FEF9C3] border border-[#A16207]/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-[#A16207]" />
              <span className="font-display font-semibold text-[14px] text-[#A16207]">Atenção necessária</span>
            </div>
            <ul className="space-y-1 font-body text-[13px] text-[#4D4D4D]">
              {(diaristasCount ?? 0) > 0 && <li>• {diaristasCount} diaristas aguardando validação do RH</li>}
              {(bhCount ?? 0) > 0 && <li>• {bhCount} colaboradores com saldo de banco de horas crítico</li>}
            </ul>
          </div>
        )}

        {/* Cards */}
        <div>
          <h2 className="font-display font-semibold text-[18px] text-[#171717] mb-4">Pendências do Sistema</h2>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            <PipelineCard icon={ClipboardCheck} label="Operações" count={opCount ?? null} sublabel="total de operações registradas" color="orange" onClick={() => navigate("/operacional/operacoes")} />
            <PipelineCard icon={Clock} label="Pontos Hoje" count={pontoCount ?? null} sublabel="registros do dia atual" color="blue" onClick={() => navigate("/operacional/pontos")} />
            <PipelineCard icon={UserCheck} label="Diaristas Pendentes" count={diaristasCount ?? null} sublabel="aguardando validação RH" color="yellow" onClick={() => navigate("/rh/diaristas")} />
            <PipelineCard icon={Scale} label="Saldos Críticos BH" count={bhCount ?? null} sublabel="saldo negativo no banco de horas" color="red" onClick={() => navigate("/banco-horas")} />
            <PipelineCard icon={Package} label="Fechamentos Pendentes" count={fechamentoCount ?? null} sublabel="aguardando processamento" color="yellow" onClick={() => navigate("/fechamento")} />
            <PipelineCard icon={Wallet} label="Central Financeira" count={null} sublabel="pagamentos e faturamento" color="green" onClick={() => navigate("/financeiro")} />
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default CentralOperacional;
