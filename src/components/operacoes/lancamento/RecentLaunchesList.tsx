import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Clock,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Inbox,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useLancamentosHojePortal,
  LancamentoHojePortal,
} from "@/hooks/useLancamentosHojePortal";

interface RecentLaunchesListProps {
  date?: string;
  empresaId?: string | null;
  unidadeId?: string | null;
}

export function RecentLaunchesList({ date, empresaId }: RecentLaunchesListProps) {
  const [showAll, setShowAll] = useState(false);
  const [selectedEmpresaFilter, setSelectedEmpresaFilter] = useState<string>("");

  const activeEmpresaContext = selectedEmpresaFilter || empresaId;

  const {
    launches,
    isLoading,
    isError,
    error,
    isIndeterminateScope,
    hasMultipleAuthorizedEmpresas,
    hasNoAuthorizedEmpresas,
    empresasAutorizadas,
    refetch,
    effectiveEmpresaId,
  } = useLancamentosHojePortal({
    date,
    contextEmpresaId: activeEmpresaContext,
  });

  return (
    <div className="space-y-3">
      {/* Seletor contextual se houver mais de 1 empresa autorizada */}
      {hasMultipleAuthorizedEmpresas && (
        <div className="flex items-center justify-between gap-2 p-2 bg-slate-50/70 border border-slate-100 rounded-xl">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pl-1">
            <Building2 className="h-3.5 w-3.5" />
            Empresa
          </span>
          <Select
            value={effectiveEmpresaId || selectedEmpresaFilter}
            onValueChange={setSelectedEmpresaFilter}
          >
            <SelectTrigger className="h-8 text-xs w-[180px] sm:w-[220px] bg-white border-slate-200">
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresasAutorizadas.map((emp: any) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 1. Estado: Escopo Indeterminado (Segurança Fail-Closed) */}
      {isIndeterminateScope && (
        <div className="p-6 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl space-y-2">
          {hasMultipleAuthorizedEmpresas ? (
            <>
              <Building2 className="h-7 w-7 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Selecione uma empresa para visualizar as atividades de hoje
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Escolha uma das empresas autorizadas no seletor acima para carregar o histórico de hoje.
              </p>
            </>
          ) : (
            <>
              <HelpCircle className="h-7 w-7 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Não foi possível determinar a empresa operacional deste acesso
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Nenhuma empresa operacional foi vinculada a este perfil.
              </p>
            </>
          )}
        </div>
      )}

      {/* 2. Estado: Loading (Skeleton compacto de cards) */}
      {isLoading && (
        <div className="space-y-3 p-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm animate-pulse space-y-2.5"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 w-24 bg-slate-100 rounded-full" />
                <div className="h-3 w-12 bg-slate-100 rounded" />
              </div>
              <div className="h-4 w-3/4 bg-slate-100 rounded" />
              <div className="flex justify-between items-center pt-1">
                <div className="h-3 w-20 bg-slate-100 rounded" />
                <div className="h-4 w-16 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Estado: Erro de Carregamento */}
      {!isLoading && isError && (
        <div className="p-6 text-center bg-rose-50/50 border border-rose-200 rounded-2xl space-y-3">
          <AlertCircle className="h-7 w-7 text-rose-500 mx-auto" />
          <div>
            <p className="text-xs font-bold text-rose-900">
              Não foi possível carregar os lançamentos de hoje
            </p>
            <p className="text-[11px] text-rose-600 mt-0.5">
              {error instanceof Error ? error.message : "Erro ao consultar as bases operacionais."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* 4. Estado: Vazio Real (Empty Real) */}
      {!isLoading && !isError && !isIndeterminateScope && launches.length === 0 && (
        <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-2xl space-y-2">
          <Inbox className="h-8 w-8 text-slate-300 mx-auto stroke-1" />
          <p className="text-xs font-medium text-slate-500">
            Nenhum lançamento realizado hoje.
          </p>
        </div>
      )}

      {/* 5. Estado: Lista de Cards Mobile-First (limite inicial de 5) */}
      {!isLoading && !isError && !isIndeterminateScope && launches.length > 0 && (
        <>
          {(showAll ? launches : launches.slice(0, 5)).map((item: LancamentoHojePortal) => (
            <div
              key={item.id}
              className="bg-white border border-slate-100 hover:border-slate-200 rounded-2xl p-4 shadow-sm transition-all space-y-2.5"
            >
              {/* Linha 1: Badge do Tipo + Horário */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border tracking-wide",
                    item.tipoBadgeClass
                  )}
                >
                  {item.tipoLabel}
                </span>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono font-medium">
                  <Clock className="h-3 w-3" />
                  <span>{item.horario}</span>
                </div>
              </div>

              {/* Linha 2: Título e Subtítulo */}
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-900 line-clamp-1 leading-snug">
                  {item.titulo}
                </h4>
                {item.subtitulo && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {item.subtitulo}
                  </p>
                )}
              </div>

              {/* Linha 3: Empresa, Valor e Status */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-50 text-xs">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="font-semibold text-slate-700 truncate max-w-[140px] sm:max-w-[200px]">
                    {item.empresaNome}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border leading-none shrink-0 flex items-center gap-1",
                      item.statusColorClass
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {item.statusLabel}
                  </span>
                </div>

                {item.valor !== undefined && item.valor > 0 ? (
                  <span className="font-bold text-slate-900 font-mono shrink-0">
                    {formatCurrency(item.valor)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}

          {/* Ação de expansão se houver mais de 5 itens */}
          {launches.length > 5 && (
            <div className="pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="w-full h-9 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl font-medium"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1.5" />
                    Recolher
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1.5" />
                    Ver mais {launches.length - 5}{" "}
                    {launches.length - 5 === 1 ? "lançamento" : "lançamentos"}
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
