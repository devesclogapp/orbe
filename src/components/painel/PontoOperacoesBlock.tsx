import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusChip } from "./StatusChip";
import {
  Clock,
  RefreshCw,
  Boxes,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  User,
  LogIn,
  LogOut,
  UtensilsCrossed,
  Coffee,
  Timer,
  Zap,
  CalendarDays,
  DollarSign,
  CheckCircle2,
  Truck,
  Package,
  Hash,
  Hourglass,
  BadgeDollarSign,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useSelection } from "@/contexts/SelectionContext";
import { PontoService, OperacaoService } from "@/services/base.service";

export const PontoOperacoesBlock = ({ date, empresaId }: { date: string; empresaId: string }) => {
  const { defaultTab } = usePreferences();
  const [tab, setTab] = useState<"ponto" | "operacoes">(defaultTab);
  const queryClient = useQueryClient();

  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border gap-4 flex-wrap">
        <div className="inline-flex items-center bg-muted rounded-lg p-1">
          <TabButton active={tab === "ponto"} onClick={() => setTab("ponto")} icon={<Clock className="h-3.5 w-3.5" />}>
            Ponto
          </TabButton>
          <TabButton active={tab === "operacoes"} onClick={() => setTab("operacoes")} icon={<Boxes className="h-3.5 w-3.5" />}>
            Operações
          </TabButton>
        </div>

        {tab === "ponto" ? (
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["ponto", date, empresaId] })}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors group"
          >
            <RefreshCw className="h-3.5 w-3.5 group-active:animate-spin" /> Atualizar dados
          </button>
        ) : (
          <Button size="sm" className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova operação
          </Button>
        )}
      </header>

      {tab === "ponto" ? <PontoTable date={date} empresaId={empresaId} /> : <OperacoesTable date={date} empresaId={empresaId} />}
    </section>
  );
};

const TabButton = ({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors",
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    )}
  >
    {icon}
    {children}
  </button>
);

const PontoTable = ({ date, empresaId }: { date: string; empresaId: string }) => {
  const { id: selectedId, kind, select } = useSelection();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ponto", date, empresaId],
    queryFn: () => PontoService.getByDate(date, empresaId === "all" ? undefined : empresaId),
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Carregando registros de ponto...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="esc-table-header">
          <tr className="text-left font-display">
            <th className="px-5 font-semibold py-3"><span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />Colaborador</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogIn className="h-3.5 w-3.5 text-muted-foreground" />Entrada</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />Saída almoço</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Coffee className="h-3.5 w-3.5 text-muted-foreground" />Retorno almoço</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogOut className="h-3.5 w-3.5 text-muted-foreground" />Saída</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-muted-foreground" />Horas</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-muted-foreground" />Extras</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />Tipo dia</span></th>
            <th className="px-3 font-semibold text-right"><span className="inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />Valor do dia</span></th>
            <th className="px-5 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />Status</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => {
            const isSelected = kind === "colaborador" && selectedId === r.colaborador_id;
            return (
              <tr
                key={r.id}
                onClick={() => select("colaborador", r.colaborador_id)}
                className={cn(
                  "esc-table-row cursor-pointer transition-all",
                  r.status === "inconsistente" && "bg-rowAlert border-l-[3px] border-l-primary",
                  isSelected && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                )}
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-foreground">{r.colaboradores?.nome}</div>
                  <div className="text-xs text-muted-foreground">{r.colaboradores?.cargo} · {r.colaboradores?.empresas?.nome}</div>
                </td>
                <td className="px-3 text-center text-foreground">{r.entrada || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{r.saida_almoco || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{r.retorno_almoco || "-"}</td>
                <td className="px-3 text-center text-foreground">{r.saida || "-"}</td>
                <td className="px-3 text-center font-display font-medium">{r.horas_trabalhadas || "0h00"}</td>
                <td className="px-3 text-center text-muted-foreground">{r.horas_extras || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{r.tipo_dia}</td>
                <td className="px-3 text-right font-display font-semibold text-foreground">
                  R$ {Number(r.valor_dia || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 text-center"><StatusChip status={r.status} /></td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="p-12 text-center text-muted-foreground italic">Nenhum registro encontrado para {date}.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const OperacoesTable = ({ date, empresaId }: { date: string; empresaId: string }) => {
  const { id: selectedId, kind, select } = useSelection();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["operacoes", date, empresaId],
    queryFn: () => OperacaoService.getPainelByDate(date, empresaId === "all" ? undefined : empresaId),
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Carregando operações...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="esc-table-header">
          <tr className="text-left font-display">
            <th className="px-5 font-semibold py-3"><span className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-muted-foreground" />Operação</span></th>
            <th className="px-3 font-semibold"><span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-muted-foreground" />Transportadora</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5 text-muted-foreground" />Serviço</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" />Qtd</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogIn className="h-3.5 w-3.5 text-muted-foreground" />Início</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogOut className="h-3.5 w-3.5 text-muted-foreground" />Fim</span></th>
            <th className="px-3 font-semibold text-right"><span className="inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />Valor unit.</span></th>
            <th className="px-3 font-semibold text-right"><span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground" />Valor do dia</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />Status</span></th>
            <th className="px-5 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Hourglass className="h-3.5 w-3.5 text-muted-foreground" />Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o: any) => {
            const isSelected = kind === "operacao" && selectedId === o.id;
            const valorTotal = Number(o.valor_total_label ?? (Number(o.quantidade) * Number(o.valor_unitario || 0)));

            return (
              <tr
                key={o.id}
                onClick={() => select("operacao", o.id)}
                className={cn(
                  "esc-table-row cursor-pointer transition-all",
                  o.status === "inconsistente" && "bg-rowAlert border-l-[3px] border-l-primary",
                  isSelected && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                )}
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-foreground">{o.id.substring(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{o.produto_label || o.produto || "Sem produto"}</div>
                </td>
                <td className="px-3 text-foreground">{o.transportadora_label || o.transportadora || "Sem transportadora"}</td>
                <td className="px-3 text-center text-muted-foreground">{o.tipo_servico_label || o.tipo_servico || "Sem serviço"}</td>
                <td className="px-3 text-center font-display font-medium">{o.quantidade_label ?? o.quantidade}</td>
                <td className="px-3 text-center text-muted-foreground">{o.horario_inicio_label || o.horario_inicio || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{o.horario_fim_label || o.horario_fim || "-"}</td>
                <td className="px-3 text-right text-muted-foreground">
                  R$ {Number(o.valor_unitario_label ?? o.valor_unitario ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 text-right font-display font-semibold text-foreground">
                  R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 text-center"><StatusChip status={o.status} /></td>
                <td className="px-5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <button className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className="h-7 w-7 rounded-md hover:bg-destructive-soft flex items-center justify-center text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="p-12 text-center text-muted-foreground italic">Nenhuma operação lançada nesta data.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
