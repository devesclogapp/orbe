import React, { useState, useMemo } from "react";
import PortalShell from "@/components/layout/PortalShell";
import { Card } from "@/components/ui/card";
import {
  Search,
  Filter,
  Eye,
  Calendar,
  Layers,
  Truck,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  X,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import {
  PortalOperacionalService,
  PortalOperacaoItem,
} from "@/services/portal/portalOperacional.service";
import { useClient } from "@/contexts/ClientContext";

export const ClientReports = () => {
  const { cliente, selectedAdminEmpresaId } = useClient();

  // Estados de Filtros
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Paginação
  const pageSize = 15;
  const [page, setPage] = useState<number>(0);

  // Operação selecionada para o modal de detalhes
  const [selectedOp, setSelectedOp] = useState<PortalOperacaoItem | null>(null);

  // Consulta de Operações através do serviço seguro
  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      "portal_cliente_operacoes_list",
      dataInicio,
      dataFim,
      statusFilter,
      page,
      selectedAdminEmpresaId,
    ],
    queryFn: () =>
      PortalOperacionalService.fetchOperacoes(
        {
          dataInicio: dataInicio || null,
          dataFim: dataFim || null,
          status: statusFilter === "all" ? null : statusFilter,
          limit: pageSize,
          offset: page * pageSize,
        },
        selectedAdminEmpresaId,
      ),
  });

  const rawItens: PortalOperacaoItem[] = data?.itens || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Filtro de busca textual em memória (NF, Placa, Transportadora, Fornecedor, Produto)
  const itens = useMemo(() => {
    if (!searchTerm.trim()) return rawItens;
    const term = searchTerm.toLowerCase();
    return rawItens.filter(
      (op) =>
        op.nf_numero?.toLowerCase().includes(term) ||
        op.placa?.toLowerCase().includes(term) ||
        op.transportadora_nome?.toLowerCase().includes(term) ||
        op.fornecedor_nome?.toLowerCase().includes(term) ||
        op.produto_nome?.toLowerCase().includes(term) ||
        op.tipo_servico_nome?.toLowerCase().includes(term) ||
        op.ctrc?.toLowerCase().includes(term),
    );
  }, [rawItens, searchTerm]);

  const handleResetFilters = () => {
    setDataInicio("");
    setDataFim("");
    setStatusFilter("all");
    setSearchTerm("");
    setPage(0);
  };

  const formatHora = (hora: string | null) => {
    if (!hora) return "—";
    return hora.slice(0, 5);
  };

  return (
    <PortalShell title="Consulta de Operações Realizadas">
      <div className="space-y-6">
        {/* Painel de Filtros */}
        <Card className="p-5 border-border bg-card shadow-sm rounded-3xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Campo de Busca Rápida */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por NF, Placa, Transportadora ou Carga..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 rounded-2xl bg-background border-border text-xs sm:text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtros Estruturados */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">De:</span>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setPage(0);
                  }}
                  className="h-10 text-xs w-[135px] rounded-2xl bg-background border-border"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Até:</span>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setPage(0);
                  }}
                  className="h-10 text-xs w-[135px] rounded-2xl bg-background border-border"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-10 w-[140px] text-xs rounded-2xl bg-background border-border">
                  <SelectValue placeholder="Status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="RECEBIDO">Recebido</SelectItem>
                  <SelectItem value="AGUARDANDO_FATURAMENTO">Aguardando Faturamento</SelectItem>
                  <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  <SelectItem value="FATURADO">Faturado</SelectItem>
                </SelectContent>
              </Select>

              {(dataInicio || dataFim || statusFilter !== "all" || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-10 gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-2xl"
                  title="Limpar todos os filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Tabela de Operações */}
        <Card className="border-border bg-card shadow-sm rounded-3xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-sm sm:text-base">
                Registros de Operações
              </h3>
              <p className="text-xs text-muted-foreground">
                Total de {totalCount} registro(s) localizado(s) para sua empresa.
              </p>
            </div>

            <Badge variant="outline" className="text-xs font-semibold">
              Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                <div className="w-7 h-7 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Carregando operações...</span>
              </div>
            ) : itens.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <Inbox className="w-10 h-10 text-muted-foreground mx-auto stroke-1" />
                <h4 className="text-sm font-semibold text-foreground">
                  Nenhuma operação encontrada
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {dataInicio || dataFim || statusFilter !== "all" || searchTerm
                    ? "Tente ajustar os filtros de busca para visualizar outros períodos."
                    : "As atividades operacionais validadas pela ESC LOG aparecerão aqui automaticamente."}
                </p>
              </div>
            ) : (
              <table className="min-w-full text-xs">
                <thead className="bg-muted/30 text-left">
                  <tr>
                    <th className="px-5 py-3.5 font-medium text-muted-foreground">Data</th>
                    <th className="px-4 py-3.5 font-medium text-muted-foreground">Serviço</th>
                    <th className="px-4 py-3.5 font-medium text-muted-foreground">Carga / Produto</th>
                    <th className="px-4 py-3.5 font-medium text-muted-foreground text-right">Qtd</th>
                    <th className="px-4 py-3.5 font-medium text-muted-foreground">Transportadora</th>
                    <th className="px-4 py-3.5 font-medium text-muted-foreground">Placa</th>
                    <th className="px-4 py-3.5 font-medium text-muted-foreground">NF / CTRC</th>
                    <th className="px-4 py-3.5 font-medium text-muted-foreground">Horários</th>
                    <th className="px-4 py-3.5 font-medium text-muted-foreground">Status</th>
                    <th className="px-5 py-3.5 font-medium text-muted-foreground text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {itens.map((op) => (
                    <tr key={op.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4 font-semibold text-foreground whitespace-nowrap">
                        {new Date(op.data_operacao + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-semibold text-foreground">{op.tipo_servico_nome}</span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <div className="font-medium text-foreground truncate max-w-[170px]" title={op.produto_nome}>
                          {op.produto_nome}
                        </div>
                        {op.fornecedor_nome && op.fornecedor_nome !== "-" && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[170px]" title={op.fornecedor_nome}>
                            Forn: {op.fornecedor_nome}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        {Number(op.quantidade || 0).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                        <div className="truncate max-w-[150px]" title={op.transportadora_nome}>
                          {op.transportadora_nome}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-muted-foreground whitespace-nowrap uppercase">
                        {op.placa}
                      </td>
                      <td className="px-4 py-4 font-mono text-muted-foreground whitespace-nowrap">
                        <div>NF: {op.nf_numero}</div>
                        {op.ctrc && op.ctrc !== "-" && (
                          <div className="text-[10px] text-muted-foreground">CT: {op.ctrc}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 font-mono text-muted-foreground whitespace-nowrap">
                        {formatHora(op.horario_inicio)} - {formatHora(op.horario_fim)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            op.status_operacional === "Recebido"
                              ? "text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400"
                              : op.status_operacional === "Faturado"
                              ? "text-[10px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400"
                              : "text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                          }
                        >
                          <CheckCircle2
                            className={
                              op.status_operacional === "Recebido"
                                ? "w-3 h-3 mr-1 text-blue-600 shrink-0"
                                : op.status_operacional === "Faturado"
                                ? "w-3 h-3 mr-1 text-purple-600 shrink-0"
                                : "w-3 h-3 mr-1 text-emerald-600 shrink-0"
                            }
                          />
                          {op.status_operacional}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs rounded-xl border-border/80 hover:bg-muted/50"
                          onClick={() => setSelectedOp(op)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Rodapé com Paginação */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Mostrando {page * pageSize + 1} a {Math.min((page + 1) * pageSize, totalCount)} de {totalCount} registros
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  className="h-8 gap-1 rounded-xl"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  className="h-8 gap-1 rounded-xl"
                >
                  Próxima
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Modal de Detalhamento da Operação */}
      <Dialog open={Boolean(selectedOp)} onOpenChange={(open) => !open && setSelectedOp(null)}>
        <DialogContent className="max-w-2xl rounded-3xl" disableDirtyCheck>
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <FileCheck2 className="w-5 h-5" />
              <DialogTitle className="text-lg font-bold">Detalhamento da Operação</DialogTitle>
            </div>
            <DialogDescription>
              Dados operacionais certificados pela ESC LOG para esta atividade.
            </DialogDescription>
          </DialogHeader>

          {selectedOp && (
            <div className="space-y-4 pt-2">
              {/* Destaque Principal */}
              <div className="rounded-2xl border border-border bg-muted/20 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Data</span>
                  <p className="text-sm font-bold text-foreground">
                    {new Date(selectedOp.data_operacao + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Volume</span>
                  <p className="text-sm font-bold text-foreground font-mono">
                    {Number(selectedOp.quantidade || 0).toLocaleString("pt-BR")} un
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Status</span>
                  <div className="mt-0.5">
                    <Badge
                      variant="outline"
                      className={
                        selectedOp.status_operacional === "Recebido"
                          ? "text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                          : selectedOp.status_operacional === "Faturado"
                          ? "text-[10px] bg-purple-50 text-purple-700 border-purple-200"
                          : "text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                      }
                    >
                      {selectedOp.status_operacional}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Horário</span>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {formatHora(selectedOp.horario_inicio)} às {formatHora(selectedOp.horario_fim)}
                  </p>
                </div>
              </div>

              {/* Informações de Carga e Transporte */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Transporte & Identificação
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Empresa Contratante:</span>
                    <p className="font-semibold text-foreground">{selectedOp.empresa_nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo de Serviço:</span>
                    <p className="font-semibold text-foreground">{selectedOp.tipo_servico_nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Produto / Tipo de Carga:</span>
                    <p className="font-semibold text-foreground">{selectedOp.produto_nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transportadora:</span>
                    <p className="font-semibold text-foreground">{selectedOp.transportadora_nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fornecedor / Origem:</span>
                    <p className="font-semibold text-foreground">{selectedOp.fornecedor_nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Placa do Veículo:</span>
                    <p className="font-semibold text-foreground font-mono uppercase">{selectedOp.placa}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nota Fiscal (NF):</span>
                    <p className="font-semibold text-foreground font-mono">{selectedOp.nf_numero}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CTRC:</span>
                    <p className="font-semibold text-foreground font-mono">{selectedOp.ctrc}</p>
                  </div>
                </div>
              </div>

              {/* Observações da Operação */}
              {selectedOp.observacao ? (
                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-1">
                  <span className="text-xs font-semibold text-foreground">Observações Operacionais</span>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedOp.observacao}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setSelectedOp(null)}
              className="rounded-xl text-xs font-semibold"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
};

export default ClientReports;
