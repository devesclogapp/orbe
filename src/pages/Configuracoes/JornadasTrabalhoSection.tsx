/**
 * ==============================================================================
 * COMPONENTE: JornadasTrabalhoSection
 * Módulo: Preferências > Configurações Operacionais
 * Responsabilidade: Interface administrativa para configuração e governança das
 * jornadas de trabalho CLT utilizando exclusivamente a entidade jornadas_trabalho.
 * 
 * Regras:
 * - Não cria jornadas reais automaticamente.
 * - Consome a definição canônica da Referência Geral CLT (REFERENCIA_GERAL_CLT_PADRAO).
 * - Não permite exclusão física de jornadas (apenas desativação / soft delete).
 * - Calcula em tempo real a carga semanal e divisor mensal derivado.
 * ==============================================================================
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Plus,
  Pencil,
  Ban,
  Building2,
  Globe,
  Sparkles,
  Info,
  Clock,
  Loader2,
  Check,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { JornadaService } from '@/services/jornada.service';
import { EmpresaService } from '@/services/base.service';
import { REFERENCIA_GERAL_CLT_PADRAO } from '@/services/operationalEngine/RemuneracaoResolver';
import {
  JornadaTrabalho,
  CriarJornadaDTO,
  AtualizarJornadaDTO,
  GradeSemanal,
  DiaSemana,
  TipoDiaJornada,
  TipoEscala,
  PoliticaFeriado,
} from '@/types/jornada.types';
import {
  DIAS_CONFIG,
  TIPOS_DIA_OPTIONS,
  minutesToTime,
  timeToMinutes,
  formatMinutesToHours,
  calcularCargaSemanal,
  derivarDivisorMensal,
  criarGradeVazia,
  criarGradeTemplate44h,
  criarGradeTemplate40h,
  criarGradeTemplate36h,
  formatarResumoGrade,
  validarFormularioJornada,
} from './jornadaFormUtils';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export const JornadasTrabalhoSection: React.FC = () => {
  const queryClient = useQueryClient();

  // Estados de controle do formulário
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [desativarConfirmId, setDesativarConfirmId] = useState<string | null>(null);

  // Campos do formulário
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [escopo, setEscopo] = useState<'geral' | 'empresa'>('geral');
  const [empresaId, setEmpresaId] = useState<string>('');
  const [tipoEscala, setTipoEscala] = useState<TipoEscala>('SEMANAL');
  const [politicaFeriado, setPoliticaFeriado] = useState<PoliticaFeriado>('FOLGA_DSR');
  const [vigenciaInicio, setVigenciaInicio] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [vigenciaFim, setVigenciaFim] = useState('');
  const [isPadrao, setIsPadrao] = useState(false);
  const [gradeSemanal, setGradeSemanal] = useState<GradeSemanal>(criarGradeVazia());

  // Queries
  const { data: jornadas = [], isLoading: loadingJornadas } = useQuery({
    queryKey: ['jornadas_trabalho'],
    queryFn: () => JornadaService.listar(),
  });

  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ['empresas_all'],
    queryFn: () => EmpresaService.getAll(),
  });

  const empresasMap = useMemo(() => {
    const map = new Map<string, string>();
    empresas.forEach((e: any) => {
      map.set(e.id, e.nome || 'Empresa');
    });
    return map;
  }, [empresas]);

  // Carga semanal calculada em tempo real a partir da grade
  const cargaSemanalMinutos = useMemo(
    () => calcularCargaSemanal(gradeSemanal),
    [gradeSemanal]
  );
  const divisorDerivado = useMemo(
    () => derivarDivisorMensal(cargaSemanalMinutos),
    [cargaSemanalMinutos]
  );

  // Mutações
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validação operacional antes de chamar a persistência
      const validacao = validarFormularioJornada({
        nome,
        vigencia_inicio: vigenciaInicio,
        escopo,
        empresa_id: empresaId,
        grade_semanal: gradeSemanal,
        carga_semanal_minutos: cargaSemanalMinutos,
      });

      if (!validacao.valido) {
        throw new Error(validacao.erros.join(' '));
      }

      if (editingId) {
        const dto: AtualizarJornadaDTO = {
          nome,
          descricao: descricao.trim() || null,
          empresa_id: escopo === 'empresa' ? empresaId : null,
          tipo_escala: tipoEscala,
          carga_semanal_minutos: cargaSemanalMinutos,
          grade_semanal: gradeSemanal,
          politica_feriado: politicaFeriado,
          vigencia_inicio: vigenciaInicio,
          vigencia_fim: vigenciaFim.trim() || null,
          padrao: isPadrao,
        };
        return await JornadaService.atualizar(editingId, dto);
      } else {
        const dto: CriarJornadaDTO = {
          nome,
          descricao: descricao.trim() || null,
          empresa_id: escopo === 'empresa' ? empresaId : null,
          tipo_escala: tipoEscala,
          carga_semanal_minutos: cargaSemanalMinutos,
          grade_semanal: gradeSemanal,
          politica_feriado: politicaFeriado,
          vigencia_inicio: vigenciaInicio,
          vigencia_fim: vigenciaFim.trim() || null,
          padrao: isPadrao,
          status: 'ativo',
        };
        return await JornadaService.criar(dto);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jornadas_trabalho'] });
      toast.success(
        editingId
          ? 'Jornada atualizada com sucesso!'
          : 'Jornada cadastrada com sucesso!'
      );
      fecharModal();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Falha ao salvar jornada de trabalho.');
    },
  });

  const desativarMutation = useMutation({
    mutationFn: async (id: string) => {
      await JornadaService.desativar(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jornadas_trabalho'] });
      toast.success('Jornada desativada com sucesso.');
      setDesativarConfirmId(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Falha ao desativar jornada.');
    },
  });

  // Handlers
  const abrirNovaJornada = () => {
    setEditingId(null);
    setNome('');
    setDescricao('');
    setEscopo('geral');
    setEmpresaId('');
    setTipoEscala('SEMANAL');
    setPoliticaFeriado('FOLGA_DSR');
    setVigenciaInicio(new Date().toISOString().split('T')[0]);
    setVigenciaFim('');
    setIsPadrao(false);
    setGradeSemanal(criarGradeVazia());
    setModalOpen(true);
  };

  const abrirEdicaoJornada = (jornada: JornadaTrabalho) => {
    setEditingId(jornada.id);
    setNome(jornada.nome);
    setDescricao(jornada.descricao || '');
    setEscopo(jornada.empresa_id ? 'empresa' : 'geral');
    setEmpresaId(jornada.empresa_id || '');
    setTipoEscala(jornada.tipo_escala);
    setPoliticaFeriado(jornada.politica_feriado);
    setVigenciaInicio(jornada.vigencia_inicio);
    setVigenciaFim(jornada.vigencia_fim || '');
    setIsPadrao(Boolean(jornada.padrao));
    setGradeSemanal(jornada.grade_semanal);
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleUpdateDia = (
    diaKey: DiaSemana,
    campo: 'tipo' | 'horario',
    valor: string
  ) => {
    setGradeSemanal((prev) => {
      const atual = prev[diaKey] || {
        trabalhavel: false,
        minutos_previstos: 0,
        tipo: 'TRABALHO',
      };
      const copia = { ...prev };

      if (campo === 'tipo') {
        const novoTipo = valor as TipoDiaJornada;
        if (novoTipo === 'TRABALHO') {
          // Se passou para trabalho e minutos estavam 0, sugere 08:48 como auxílio visual
          const minutos = atual.minutos_previstos > 0 ? atual.minutos_previstos : 528;
          copia[diaKey] = {
            ...atual,
            tipo: novoTipo,
            trabalhavel: true,
            minutos_previstos: minutos,
          };
        } else {
          // Dias de folga, DSR ou compensado não possuem minutos a cumprir
          copia[diaKey] = {
            ...atual,
            tipo: novoTipo,
            trabalhavel: false,
            minutos_previstos: 0,
          };
        }
      } else if (campo === 'horario') {
        const minutos = timeToMinutes(valor);
        copia[diaKey] = {
          ...atual,
          minutos_previstos: minutos,
          trabalhavel: minutos > 0,
        };
      }

      return copia;
    });
  };

  // Valores canônicos da Referência Geral CLT Vigente
  const cargaReferenciaHoras = REFERENCIA_GERAL_CLT_PADRAO.cargaSemanalMinutos / 60;
  const divisorReferencia = REFERENCIA_GERAL_CLT_PADRAO.divisorMensal;

  return (
    <section className="esc-card p-6 mt-6 space-y-6">
      {/* 1. CABEÇALHO DA SEÇÃO */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display font-semibold text-lg text-foreground flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Jornadas de Trabalho
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure as jornadas utilizadas pelos colaboradores para apuração de ponto, atrasos, horas extras e banco de horas.
          </p>
        </div>
        <Button onClick={abrirNovaJornada} size="sm" className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova jornada
        </Button>
      </div>

      {/* 2. BLOCO INFORMATIVO: REFERÊNCIA GERAL CLT VIGENTE */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-0.5">
            <Scale className="h-5 w-5" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-blue-950 dark:text-blue-200">
                Referência geral CLT vigente:
              </span>
              <Badge variant="outline" className="border-blue-400/30 text-blue-700 dark:text-blue-300 font-medium">
                {cargaReferenciaHoras}h semanais
              </Badge>
              <Badge variant="outline" className="border-blue-400/30 text-blue-700 dark:text-blue-300 font-medium">
                Divisor de referência: {divisorReferencia}
              </Badge>
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs">
                Referência geral — não substitui uma jornada configurada
              </Badge>
            </div>
            <p className="text-xs text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
              A apuração de ponto e banco de horas permanece rigorosamente bloqueada (Gate 2 de Jornada) até que uma jornada formal seja configurada para o colaborador, empresa ou geral. A referência geral serve exclusivamente para visualizações seguras e derivações de remuneração base, não autorizando o processamento automático.
            </p>
          </div>
        </div>
      </div>

      {/* 3. LISTAGEM DE JORNADAS */}
      {loadingJornadas ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
          Carregando jornadas cadastradas...
        </div>
      ) : jornadas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 p-8 text-center space-y-3">
          <CalendarClock className="h-10 w-10 text-muted-foreground/60 mx-auto" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Não há jornadas configuradas.</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Enquanto não houver uma jornada válida, colaboradores CLT permanecem bloqueados para processamento de ponto.
            </p>
          </div>
          <Button onClick={abrirNovaJornada} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova jornada
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {jornadas.map((jornada) => {
            const empresaNome = jornada.empresa_id
              ? empresasMap.get(jornada.empresa_id) || 'Empresa vinculada'
              : null;
            const cargaHoras = formatMinutesToHours(jornada.carga_semanal_minutos);
            const divisor = (jornada.carga_semanal_minutos / 12).toFixed(1);
            const resumoSemana = formatarResumoGrade(jornada.grade_semanal);

            return (
              <div
                key={jornada.id}
                className="rounded-xl border border-border/60 bg-card p-4 space-y-3 transition-all hover:border-border"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground text-base">
                        {jornada.nome}
                      </h4>
                      {jornada.padrao && (
                        <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {jornada.empresa_id ? 'Padrão da Empresa' : 'Padrão Geral do Tenant'}
                        </Badge>
                      )}
                      {empresaNome ? (
                        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {empresaNome}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          Geral do Tenant
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          jornada.status === 'ativo'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs'
                            : 'bg-muted text-muted-foreground text-xs'
                        }
                      >
                        {jornada.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Escala {jornada.tipo_escala}
                      </Badge>
                    </div>
                    {jornada.descricao && (
                      <p className="text-xs text-muted-foreground">{jornada.descricao}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirEdicaoJornada(jornada)}
                      className="h-8 px-3 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                    {jornada.status === 'ativo' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDesativarConfirmId(jornada.id)}
                        className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Desativar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Métricas e Resumo da semana */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/40 text-xs">
                  <div>
                    <span className="text-muted-foreground">Carga Semanal: </span>
                    <strong className="text-foreground font-semibold">
                      {cargaHoras}
                    </strong>
                    <span className="text-muted-foreground ml-1">
                      (Divisor {divisor})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vigência: </span>
                    <span className="text-foreground">
                      Válida desde {formatDate(jornada.vigencia_inicio)}
                      {jornada.vigencia_fim ? ` até ${formatDate(jornada.vigencia_fim)}` : ' (Indeterminada)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Grade: </span>
                    <span className="font-mono text-muted-foreground font-medium">
                      {resumoSemana}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL / DIALOG DE CADASTRO E EDIÇÃO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-primary" />
              {editingId ? 'Editar Jornada de Trabalho' : 'Nova Jornada de Trabalho'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados e a grade semanal. A carga semanal e o divisor mensal serão apurados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Bloco 1: Identificação Básica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="nome_jornada" className="text-xs font-semibold">
                  Nome da Jornada *
                </Label>
                <Input
                  id="nome_jornada"
                  placeholder="Ex: Padrão Operacional 44h (Seg-Sex 08:48)"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="desc_jornada" className="text-xs font-semibold">
                  Descrição (Opcional)
                </Label>
                <Input
                  id="desc_jornada"
                  placeholder="Detalhes sobre a jornada, turno ou setor de aplicação"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Aplicação / Escopo *</Label>
                <Select
                  value={escopo}
                  onValueChange={(val: 'geral' | 'empresa') => {
                    setEscopo(val);
                    if (val === 'geral') setEmpresaId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral do Tenant (Todas as empresas sem jornada própria)</SelectItem>
                    <SelectItem value="empresa">Empresa Específica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {escopo === 'empresa' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Empresa *</Label>
                  <Select value={empresaId} onValueChange={setEmpresaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipo de Escala *</Label>
                  <Select
                    value={tipoEscala}
                    onValueChange={(v: TipoEscala) => setTipoEscala(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEMANAL">Semanal (Padrão Seg a Sex / Sáb)</SelectItem>
                      <SelectItem value="5X2">5x2 (5 dias de trabalho, 2 de folga)</SelectItem>
                      <SelectItem value="6X1">6x1 (6 dias de trabalho, 1 de folga)</SelectItem>
                      <SelectItem value="12X36">12x36 (12h de trabalho, 36h de folga)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {escopo === 'empresa' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipo de Escala *</Label>
                  <Select
                    value={tipoEscala}
                    onValueChange={(v: TipoEscala) => setTipoEscala(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEMANAL">Semanal (Padrão Seg a Sex / Sáb)</SelectItem>
                      <SelectItem value="5X2">5x2 (5 dias de trabalho, 2 de folga)</SelectItem>
                      <SelectItem value="6X1">6x1 (6 dias de trabalho, 1 de folga)</SelectItem>
                      <SelectItem value="12X36">12x36 (12h de trabalho, 36h de folga)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Política em Feriados *</Label>
                <Select
                  value={politicaFeriado}
                  onValueChange={(v: PoliticaFeriado) => setPoliticaFeriado(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOLGA_DSR">Folga / DSR (Não trabalha em feriados)</SelectItem>
                    <SelectItem value="TRABALHA_NORMAL">Trabalha Normal (Jornada prevista normal)</SelectItem>
                    <SelectItem value="TRABALHA_EXTRA">Trabalha Extra (Horas contam 100% como extra)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Vigência Inicial *</Label>
                <Input
                  type="date"
                  value={vigenciaInicio}
                  onChange={(e) => setVigenciaInicio(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Vigência Final (Opcional)</Label>
                <Input
                  type="date"
                  value={vigenciaFim}
                  onChange={(e) => setVigenciaFim(e.target.value)}
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="switch_padrao" className="text-sm font-semibold cursor-pointer">
                    Definir como jornada padrão deste escopo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ao marcar, substitui a jornada padrão anterior deste mesmo escopo ({escopo === 'empresa' ? 'desta empresa' : 'do tenant'}).
                  </p>
                </div>
                <Switch
                  id="switch_padrao"
                  checked={isPadrao}
                  onCheckedChange={setIsPadrao}
                />
              </div>
            </div>

            {/* Bloco 2: Grade Semanal */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Grade Semanal</h4>
                  <p className="text-xs text-muted-foreground">
                    Defina o tipo e a jornada prevista para cada dia da semana.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">Preencher sugestão:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setGradeSemanal(criarGradeTemplate44h())}
                  >
                    44h (08:48)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setGradeSemanal(criarGradeTemplate40h())}
                  >
                    40h (08:00)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setGradeSemanal(criarGradeTemplate36h())}
                  >
                    36h (06:00)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground"
                    onClick={() => setGradeSemanal(criarGradeVazia())}
                  >
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {DIAS_CONFIG.map((dia) => {
                  const item = gradeSemanal[dia.key] || {
                    trabalhavel: false,
                    minutos_previstos: 0,
                    tipo: 'TRABALHO',
                  };
                  const isTrabalho = item.tipo === 'TRABALHO';
                  const horarioStr = minutesToTime(item.minutos_previstos);

                  return (
                    <div
                      key={dia.key}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/50 bg-background hover:bg-muted/10 transition-colors"
                    >
                      <div className="w-28">
                        <span className="font-medium text-sm text-foreground">
                          {dia.nomeCompleto}
                        </span>
                      </div>

                      <div className="w-48">
                        <Select
                          value={item.tipo}
                          onValueChange={(val) => handleUpdateDia(dia.key, 'tipo', val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_DIA_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="w-32 flex items-center gap-1.5">
                        <Input
                          type="time"
                          value={isTrabalho ? horarioStr : ''}
                          disabled={!isTrabalho}
                          onChange={(e) => handleUpdateDia(dia.key, 'horario', e.target.value)}
                          className={`h-8 text-xs ${!isTrabalho ? 'opacity-40 bg-muted cursor-not-allowed' : ''}`}
                        />
                      </div>

                      <div className="w-20 text-right">
                        <span className="text-xs text-muted-foreground font-mono">
                          {isTrabalho ? `${item.minutos_previstos} min` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Banner de cálculo em tempo real */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Carga semanal configurada:
                  </span>
                  <strong className="text-base font-bold text-foreground">
                    {formatMinutesToHours(cargaSemanalMinutos)}
                  </strong>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({cargaSemanalMinutos} minutos)
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">
                    Divisor mensal derivado (Art. 64 CLT):
                  </span>
                  <Badge variant="outline" className="text-sm font-semibold border-primary/30 text-primary">
                    {divisorDerivado > 0 ? divisorDerivado.toFixed(1) : '—'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={fecharModal} disabled={saveMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Jornada'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. DIALOG DE CONFIRMAÇÃO DE DESATIVAÇÃO */}
      <AlertDialog
        open={Boolean(desativarConfirmId)}
        onOpenChange={(open) => !open && setDesativarConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Desativar Jornada de Trabalho?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta ação desativará a jornada para novas apurações, preservando todo o histórico de pontos já processados.
              </p>
              <p className="text-xs text-muted-foreground">
                Colaboradores vinculados a esta jornada ficarão pendentes de parametrização e serão bloqueados pelo Gate 2 de Segurança no próximo ciclo até que uma nova jornada ativa seja indicada.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desativarMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={desativarMutation.isPending}
              onClick={() => {
                if (desativarConfirmId) {
                  desativarMutation.mutate(desativarConfirmId);
                }
              }}
            >
              {desativarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Ban className="h-4 w-4 mr-2" />
              )}
              Confirmar Desativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default JornadasTrabalhoSection;
