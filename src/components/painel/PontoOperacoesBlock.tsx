import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusChip } from "./StatusChip";
import { Clock, RefreshCw, Boxes, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useSelection } from "@/contexts/SelectionContext";
import { PontoService, OperacaoService } from "@/services/base.service";

export const PontoOperacoesBlock = () => {
  const { defaultTab } = usePreferences();
  const [tab, setTab] = useState<"ponto" | "operacoes">(defaultTab);

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
          <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Sincronizado agora
          </button>
        ) : (
          <Button size="sm" className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova operação
          </Button>
        )}
      </header>

      {tab === "ponto" ? <PontoTable /> : <OperacoesTable />}
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

const PontoTable = () => {
  const { id: selectedId, kind, select } = useSelection();
  const today = new Date().toISOString().split('T')[0];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ponto", today],
    queryFn: () => PontoService.getByDate(today),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando ponto...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="esc-table-header">
          <tr className="text-left">
            <th className="px-5 h-11 font-medium">Colaborador</th>
            <th className="px-3 h-11 font-medium text-center">Entrada</th>
            <th className="px-3 h-11 font-medium text-center">Saída almoço</th>
            <th className="px-3 h-11 font-medium text-center">Retorno almoço</th>
            <th className="px-3 h-11 font-medium text-center">Saída</th>
            <th className="px-3 h-11 font-medium text-center">Horas</th>
            <th className="px-3 h-11 font-medium text-center">Extras</th>
            <th className="px-3 h-11 font-medium text-center">Tipo dia</th>
            <th className="px-3 h-11 font-medium text-right">Valor do dia</th>
            <th className="px-5 h-11 font-medium text-center">Status</th>
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
                  "border-t border-muted hover:bg-background transition-colors cursor-pointer",
                  r.status === 'inconsistente' && "bg-rowAlert border-l-[3px] border-l-primary",
                  isSelected && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                )}
              >
                <td className="px-5 h-[52px]">
                  <div className="font-medium text-foreground">{r.colaboradores?.nome}</div>
                  <div className="text-xs text-muted-foreground">{r.colaboradores?.cargo} · {r.colaboradores?.empresas?.nome}</div>
                </td>
                <td className="px-3 text-center text-foreground">{r.entrada || '—'}</td>
                <td className="px-3 text-center text-muted-foreground">{r.saida_almoco || '—'}</td>
                <td className="px-3 text-center text-muted-foreground">{r.retorno_almoco || '—'}</td>
                <td className="px-3 text-center text-foreground">{r.saida || '—'}</td>
                <td className="px-3 text-center font-display font-medium">0h00</td>
                <td className="px-3 text-center text-muted-foreground">—</td>
                <td className="px-3 text-center text-muted-foreground">{r.tipo_dia}</td>
                <td className="px-3 text-right font-display font-semibold text-foreground">R$ 0,00</td>
                <td className="px-5 text-center"><StatusChip status={r.status} /></td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="p-8 text-center text-muted-foreground">Nenhum registro encontrado para hoje.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const OperacoesTable = () => {
  const { id: selectedId, kind, select } = useSelection();
  const today = new Date().toISOString().split('T')[0];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["operacoes", today],
    queryFn: () => OperacaoService.getByDate(today),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando operações...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="esc-table-header">
          <tr className="text-left">
            <th className="px-5 h-11 font-medium">Operação</th>
            <th className="px-3 h-11 font-medium">Transportadora</th>
            <th className="px-3 h-11 font-medium text-center">Serviço</th>
            <th className="px-3 h-11 font-medium text-center">Qtd</th>
            <th className="px-3 h-11 font-medium text-center">Início</th>
            <th className="px-3 h-11 font-medium text-center">Fim</th>
            <th className="px-3 h-11 font-medium text-right">Valor unit.</th>
            <th className="px-3 h-11 font-medium text-right">Valor do dia</th>
            <th className="px-3 h-11 font-medium text-center">Status</th>
            <th className="px-5 h-11 font-medium text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o: any) => {
            const isSelected = kind === "operacao" && selectedId === o.id;
            const valorTotal = Number(o.quantidade) * Number(o.valor_unitario || 0);
            return (
              <tr
                key={o.id}
                onClick={() => select("operacao", o.id)}
                className={cn(
                  "border-t border-muted hover:bg-background transition-colors cursor-pointer",
                  o.status === 'inconsistente' && "bg-rowAlert border-l-[3px] border-l-primary",
                  isSelected && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                )}
              >
                <td className="px-5 h-[52px]">
                  <div className="font-medium text-foreground">{o.id.substring(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{o.produto}</div>
                </td>
                <td className="px-3 text-foreground">{o.transportadora}</td>
                <td className="px-3 text-center text-muted-foreground">{o.tipo_servico}</td>
                <td className="px-3 text-center font-display font-medium">{o.quantidade}</td>
                <td className="px-3 text-center text-muted-foreground">{o.horario_inicio || '—'}</td>
                <td className="px-3 text-center text-muted-foreground">{o.horario_fim || '—'}</td>
                <td className="px-3 text-right text-muted-foreground">R$ {(o.valor_unitario || 0).toFixed(2).replace(".", ",")}</td>
                <td className="px-3 text-right font-display font-semibold text-foreground">R$ {valorTotal.toLocaleString('pt-BR')}</td>
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
              <td colSpan={10} className="p-8 text-center text-muted-foreground">Nenhuma operação lançada hoje.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
