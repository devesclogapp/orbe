/**
 * ORBE UX LAB — Mock Data Especialista: Torre Operacional V2 (Protótipo 2)
 * 
 * ATENÇÃO: Estes dados são exclusivamente demonstrativos e utilizados
 * unicamente no ambiente de prototipação (/ux-lab/torre).
 * NENHUM dado é gravado no banco ou compartilhado com o backend real.
 */

export type SetorResponsavel = 'Operação' | 'RH' | 'Financeiro' | 'Governança';

/**
 * SEMÂNTICA DO STATUS DA ETAPA:
 * O status da etapa representa a condição operacional predominante / saúde do estágio e do SLA,
 * e NÃO afirma que todos os processos internos estejam regulares.
 * 
 * Exemplo válido:
 * Etapa: "Regular" juntamente com "2 exigem atenção", quando as exceções pontuais
 * ainda não alteraram a condição predominante ou volumetria geral do estágio.
 */
export type SituacaoEtapa = 'normal' | 'atencao' | 'atrasado' | 'bloqueado' | 'concluido';
export type ProcessoSituacaoCategoria = 'normal' | 'aguardando_decisao' | 'bloqueado';

export interface ProcessoResumoItem {
  id: string;
  codigo: string;
  tipo: 'Operação por Volume' | 'Serviço Extra' | 'Diaristas' | 'Diarista' | 'Intermitentes' | 'Intermitente' | 'Custos Extras' | 'Custo Extra' | 'Fechamento CLT';
  cliente: string;
  unidade: string;
  tempoParado: string; // Ex: '52h na etapa'
  responsavelSetor: SetorResponsavel;
  situacaoCategoria: ProcessoSituacaoCategoria;
  situacaoTexto: string; // Ex: 'Fora do SLA', 'Em andamento', 'Aguardando aprovação', 'Inconsistência impeditiva'
  motivo?: string;
  ctaLabel: 'Abrir detalhes' | 'Ir para Aprovações' | 'Resolver inconsistência' | 'Abrir em Receitas' | 'Ir para Faturamento';
  ctaDestinoTipo: 'detalhes' | 'aprovacoes' | 'inconsistencias' | 'receitas' | 'faturamento';
  ctaContexto: {
    origem: string;
    trilha: string;
    etapa: string;
    processoId: string;
    rotaSugerida: string;
  };
  detalhe: string;
  isAtrasado?: boolean;
  isBloqueado?: boolean;
}

export interface EtapaOperacional {
  id: string;
  ordem: number;
  nome: string;
  subtitulo: string;
  trilhaId: 'trilha-receitas' | 'trilha-custos';
  trilhaTitulo: string;
  totalProcessos: number;
  processosEmAtencao: number;
  situacao: SituacaoEtapa;
  tempoMedio: string;
  slaLimite: string;
  responsavelSetorial: SetorResponsavel;
  resumoSituacao: string;
  itensExemplo: ProcessoResumoItem[];
}

export interface TrilhaOperacional {
  id: 'trilha-receitas' | 'trilha-custos';
  titulo: string;
  badgeTrilha: string;
  descricao: string;
  etapas: EtapaOperacional[];
}

export interface RadarOperacionalData {
  aguardandoAcao: number;
  foraDoSla: number;
  inconsistenciasImpeditivas: number;
  emAndamento: number;
}

export const MOCK_RADAR_OPERACIONAL: RadarOperacionalData = {
  aguardandoAcao: 8,
  foraDoSla: 3,
  inconsistenciasImpeditivas: 5,
  emAndamento: 27,
};

export const MOCK_TRILHA_RECEITAS: TrilhaOperacional = {
  id: 'trilha-receitas',
  titulo: 'Trilha A · Operações & Receitas',
  badgeTrilha: 'Ciclo de Faturamento',
  descricao: 'Acompanhamento do ciclo de receita e execução de campo (Volumes e Serviços Extras)',
  etapas: [
    {
      id: 'rec-1',
      ordem: 1,
      nome: 'Entrada de Campo',
      subtitulo: 'Descargas & Serviços Realizados',
      trilhaId: 'trilha-receitas',
      trilhaTitulo: 'Trilha A · Operações & Receitas',
      totalProcessos: 14,
      processosEmAtencao: 2,
      situacao: 'normal',
      tempoMedio: '1,5 horas',
      slaLimite: '4h',
      responsavelSetorial: 'Operação',
      resumoSituacao: '2 recém-recebidas em conferência',
      itensExemplo: [
        {
          id: 'item-r1-1',
          codigo: 'OP-2026-1042',
          tipo: 'Operação por Volume',
          cliente: 'Ambev Logística',
          unidade: 'Matriz Barueri',
          tempoParado: '45min na etapa',
          responsavelSetor: 'Operação',
          situacaoCategoria: 'normal',
          situacaoTexto: 'Em andamento regular',
          motivo: 'Descarga de 2.400 caixas finalizada pelo encarregado, conferência inicial sem avarias.',
          ctaLabel: 'Abrir detalhes',
          ctaDestinoTipo: 'detalhes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'operacoes_receitas',
            etapa: 'entrada_campo',
            processoId: 'OP-2026-1042',
            rotaSugerida: '/operacoes-volume',
          },
          detalhe: 'Descarga concluída pelo operador. Aguardando protocolo de conferência.',
        },
        {
          id: 'item-r1-2',
          codigo: 'SX-2026-088',
          tipo: 'Serviço Extra',
          cliente: 'Seara Alimentos',
          unidade: 'Filial Santos',
          tempoParado: '1,2h na etapa',
          responsavelSetor: 'Operação',
          situacaoCategoria: 'normal',
          situacaoTexto: 'Em andamento',
          motivo: 'Repaletezação de 18 pallets danificados durante transporte rodoviário.',
          ctaLabel: 'Abrir detalhes',
          ctaDestinoTipo: 'detalhes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'operacoes_receitas',
            etapa: 'entrada_campo',
            processoId: 'SX-2026-088',
            rotaSugerida: '/servicos-extras/lancamentos',
          },
          detalhe: 'Serviço extra lançado pelo encarregado da base portuária.',
        },
        {
          id: 'item-r1-3',
          codigo: 'OP-2026-1045',
          tipo: 'Operação por Volume',
          cliente: 'BRF Foods',
          unidade: 'Hub Campinas',
          tempoParado: '2,5h na etapa',
          responsavelSetor: 'Operação',
          situacaoCategoria: 'aguardando_decisao',
          situacaoTexto: 'Aguardando validação',
          motivo: 'Conferência física apurou divergência de 15 caixas em relação ao manifesto.',
          ctaLabel: 'Ir para Aprovações',
          ctaDestinoTipo: 'aprovacoes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'operacoes_receitas',
            etapa: 'entrada_campo',
            processoId: 'OP-2026-1045',
            rotaSugerida: '/operacoes-volume/aprovacoes',
          },
          detalhe: 'Aguardando decisão da gerência para liberação do comprovante de entrega.',
        },
      ],
    },
    {
      id: 'rec-2',
      ordem: 2,
      nome: 'Validação Operacional',
      subtitulo: 'Conferência de Volume & Avarias',
      trilhaId: 'trilha-receitas',
      trilhaTitulo: 'Trilha A · Operações & Receitas',
      totalProcessos: 9,
      processosEmAtencao: 3,
      situacao: 'atencao',
      tempoMedio: '5 horas',
      slaLimite: '8h',
      responsavelSetorial: 'Operação',
      resumoSituacao: '3 precisam de conferência documental',
      itensExemplo: [
        {
          id: 'item-r2-1',
          codigo: 'OP-2026-1038',
          tipo: 'Operação por Volume',
          cliente: 'BRF Foods',
          unidade: 'Hub Campinas',
          tempoParado: '5,2h na etapa',
          responsavelSetor: 'Operação',
          situacaoCategoria: 'bloqueado',
          situacaoTexto: 'Inconsistência · Divergência de volume',
          motivo: 'NF indica 1.800 caixas, mas a contagem física registrou 1.760 (-40 caixas).',
          ctaLabel: 'Resolver inconsistência',
          ctaDestinoTipo: 'inconsistencias',
          ctaContexto: {
            origem: 'torre',
            trilha: 'operacoes_receitas',
            etapa: 'validacao_operacional',
            processoId: 'OP-2026-1038',
            rotaSugerida: '/inconsistencias',
          },
          detalhe: 'Divergência de conferência física impeditiva para emissão da fatura.',
          isBloqueado: true,
        },
        {
          id: 'item-r2-2',
          codigo: 'SX-2026-085',
          tipo: 'Serviço Extra',
          cliente: 'Ambev Logística',
          unidade: 'Matriz Barueri',
          tempoParado: '6,1h na etapa',
          responsavelSetor: 'Operação',
          situacaoCategoria: 'aguardando_decisao',
          situacaoTexto: 'Aguardando aprovação supervisor',
          motivo: 'Aplicação extraordinária de filme stretch em 45 pallets fora do escopo contratual padrão.',
          ctaLabel: 'Ir para Aprovações',
          ctaDestinoTipo: 'aprovacoes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'operacoes_receitas',
            etapa: 'validacao_operacional',
            processoId: 'SX-2026-085',
            rotaSugerida: '/servicos-extras/aprovacoes',
          },
          detalhe: 'Lançamento necessita de autorização de custo adicional antes da cobrança.',
        },
        {
          id: 'item-r2-3',
          codigo: 'OP-2026-1040',
          tipo: 'Operação por Volume',
          cliente: 'Nestlé Brasil',
          unidade: 'Matriz Barueri',
          tempoParado: '3,8h na etapa',
          responsavelSetor: 'Operação',
          situacaoCategoria: 'normal',
          situacaoTexto: 'Em andamento',
          motivo: 'Conferência física finalizada sem inconformidades, gerando protocolo de entrega.',
          ctaLabel: 'Abrir detalhes',
          ctaDestinoTipo: 'detalhes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'operacoes_receitas',
            etapa: 'validacao_operacional',
            processoId: 'OP-2026-1040',
            rotaSugerida: '/operacoes-volume',
          },
          detalhe: 'Validação técnica em processamento rotineiro.',
        },
      ],
    },
    {
      id: 'rec-3',
      ordem: 3,
      nome: 'Pronto para Faturar',
      subtitulo: 'Liberação Comercial & Emissão',
      trilhaId: 'trilha-receitas',
      trilhaTitulo: 'Trilha A · Operações & Receitas',
      totalProcessos: 6,
      processosEmAtencao: 1,
      situacao: 'atrasado',
      tempoMedio: '1,4 dias',
      slaLimite: '24h',
      responsavelSetorial: 'Financeiro',
      resumoSituacao: '1 fora do SLA aguardando emissão NF',
      itensExemplo: [
        {
          id: 'item-r3-1',
          codigo: 'LOT-FAT-092',
          tipo: 'Operação por Volume',
          cliente: 'Nestlé Brasil',
          unidade: 'Matriz Barueri',
          tempoParado: '32h na etapa (SLA 24h excedido)',
          responsavelSetor: 'Financeiro',
          situacaoCategoria: 'aguardando_decisao',
          situacaoTexto: 'Fora do SLA · Aguardando emissão comercial',
          motivo: 'Operação validada pela base operacional há 32h sem emissão de duplicata fiscal.',
          ctaLabel: 'Abrir em Receitas',
          ctaDestinoTipo: 'receitas',
          ctaContexto: {
            origem: 'torre',
            trilha: 'operacoes_receitas',
            etapa: 'pronto_faturar',
            processoId: 'LOT-FAT-092',
            rotaSugerida: '/financeiro/receitas?tab=FATURAMENTO_MENSAL',
          },
          detalhe: 'Lote retido na fila financeira aguardando autorização de faturamento do cliente.',
          isAtrasado: true,
        },
        {
          id: 'item-r3-2',
          codigo: 'LOT-FAT-095',
          tipo: 'Serviço Extra',
          cliente: 'Seara Alimentos',
          unidade: 'Filial Santos',
          tempoParado: '8h na etapa',
          responsavelSetor: 'Financeiro',
          situacaoCategoria: 'normal',
          situacaoTexto: 'Pronto para emissão',
          motivo: 'Lote consolidado de transbordo e repaletezação no prazo para emissão de nota.',
          ctaLabel: 'Abrir detalhes',
          ctaDestinoTipo: 'detalhes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'operacoes_receitas',
            etapa: 'pronto_faturar',
            processoId: 'LOT-FAT-095',
            rotaSugerida: '/financeiro/receitas',
          },
          detalhe: 'Faturamento agendado para o lote de fechamento quinzenal.',
        },
      ],
    },
    {
      id: 'rec-4',
      ordem: 4,
      nome: 'Faturado / Recebimento',
      subtitulo: 'Títulos Emitidos & Conciliação',
      trilhaId: 'trilha-receitas',
      trilhaTitulo: 'Trilha A · Operações & Receitas',
      totalProcessos: 28,
      processosEmAtencao: 0,
      situacao: 'concluido',
      tempoMedio: 'Concluído',
      slaLimite: '—',
      responsavelSetorial: 'Financeiro',
      resumoSituacao: 'Ciclo faturado e conciliado',
      itensExemplo: [
        {
          id: 'item-r4-1',
          codigo: 'REC-2026-410',
          tipo: 'Operação por Volume',
          cliente: 'Ambev Logística',
          unidade: 'Matriz Barueri',
          tempoParado: 'Concluído no ciclo',
          responsavelSetor: 'Financeiro',
          situacaoCategoria: 'normal',
          situacaoTexto: 'Faturado e Conciliado',
          motivo: 'Duplicata 2026-410 enviada ao cliente com conciliação automática confirmada.',
          ctaLabel: 'Abrir detalhes',
          ctaDestinoTipo: 'detalhes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'operacoes_receitas',
            etapa: 'faturado_recebimento',
            processoId: 'REC-2026-410',
            rotaSugerida: '/financeiro/receitas',
          },
          detalhe: 'Receita liquidada na conta bancária corporativa.',
        },
      ],
    },
  ],
};

export const MOCK_TRILHA_CUSTOS: TrilhaOperacional = {
  id: 'trilha-custos',
  titulo: 'Trilha B · Mão de Obra & Custos',
  badgeTrilha: 'Ciclo de Despesas',
  descricao: 'Acompanhamento de custos de equipe, diárias e despesas operacionais (Diaristas, Intermitentes, Custos e Fechamento CLT)',
  etapas: [
    {
      id: 'cst-1',
      ordem: 1,
      nome: 'Lançamento de Campo',
      subtitulo: 'Presenças, Diárias & Despesas',
      trilhaId: 'trilha-custos',
      trilhaTitulo: 'Trilha B · Mão de Obra & Custos',
      totalProcessos: 18,
      processosEmAtencao: 4,
      situacao: 'normal',
      tempoMedio: '3 horas',
      slaLimite: '6h',
      responsavelSetorial: 'Operação',
      resumoSituacao: '4 apontamentos aguardando fechamento',
      itensExemplo: [
        {
          id: 'item-c1-1',
          codigo: 'DIA-SEM-43-01',
          tipo: 'Diarista',
          cliente: 'ESC Barueri',
          unidade: 'Matriz Barueri',
          tempoParado: '2,5h na etapa',
          responsavelSetor: 'Operação',
          situacaoCategoria: 'normal',
          situacaoTexto: 'Grade semanal aberta',
          motivo: '24 diárias lançadas na grade da Semana 43 aguardando término do turno.',
          ctaLabel: 'Abrir detalhes',
          ctaDestinoTipo: 'detalhes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'mao_obra_custos',
            etapa: 'lancamento_campo',
            processoId: 'DIA-SEM-43-01',
            rotaSugerida: '/producao/diaristas',
          },
          detalhe: 'Apontamento de presenças de campo realizado pelos encarregados.',
        },
        {
          id: 'item-c1-2',
          codigo: 'CST-EXT-214',
          tipo: 'Custo Extra',
          cliente: 'Hub Campinas',
          unidade: 'Hub Campinas',
          tempoParado: '1h na etapa',
          responsavelSetor: 'Operação',
          situacaoCategoria: 'normal',
          situacaoTexto: 'Comprovante anexado',
          motivo: 'Compra emergencial de botas de proteção (EPI) autorizada pelo líder.',
          ctaLabel: 'Abrir detalhes',
          ctaDestinoTipo: 'detalhes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'mao_obra_custos',
            etapa: 'lancamento_campo',
            processoId: 'CST-EXT-214',
            rotaSugerida: '/custos-extras/lancamentos',
          },
          detalhe: 'Despesa operacional aguardando consolidação no lote semanal.',
        },
      ],
    },
    {
      id: 'cst-2',
      ordem: 2,
      nome: 'Validação Operacional / RH',
      subtitulo: 'Conferência de Presença & Horas',
      trilhaId: 'trilha-custos',
      trilhaTitulo: 'Trilha B · Mão de Obra & Custos',
      totalProcessos: 7,
      processosEmAtencao: 2,
      situacao: 'atrasado',
      tempoMedio: '2,8 dias',
      slaLimite: '24h',
      responsavelSetorial: 'RH',
      resumoSituacao: '2 lotes fora do SLA retidos no RH',
      itensExemplo: [
        {
          id: 'item-c2-1',
          codigo: 'LOT-DIA-SEM-42',
          tipo: 'Diaristas',
          cliente: 'ESC Santos Porto',
          unidade: 'Filial Santos',
          tempoParado: '56h na etapa (SLA 24h excedido)',
          responsavelSetor: 'RH',
          situacaoCategoria: 'aguardando_decisao',
          situacaoTexto: 'Fora do SLA · Aguardando validação RH',
          motivo: 'Aguardando validação das presenças semanais pelo RH para liberação do pagamento.',
          ctaLabel: 'Ir para Aprovações',
          ctaDestinoTipo: 'aprovacoes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'mao_obra_custos',
            etapa: 'validacao_rh',
            processoId: 'LOT-DIA-SEM-42',
            rotaSugerida: '/diaristas/aprovacoes',
          },
          detalhe: 'Lote semanal de 38 diaristas retido há mais de 48h sem homologação.',
          isAtrasado: true,
        },
        {
          id: 'item-c2-2',
          codigo: 'INT-LOTE-14',
          tipo: 'Intermitente',
          cliente: 'ESC Barueri',
          unidade: 'Matriz Barueri',
          tempoParado: '30h na etapa (SLA 24h excedido)',
          responsavelSetor: 'RH',
          situacaoCategoria: 'aguardando_decisao',
          situacaoTexto: 'Aguardando validação RH',
          motivo: 'Convocação quinzenal de 12 colaboradores intermitentes aguarda ratificação de escalas.',
          ctaLabel: 'Ir para Aprovações',
          ctaDestinoTipo: 'aprovacoes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'mao_obra_custos',
            etapa: 'validacao_rh',
            processoId: 'INT-LOTE-14',
            rotaSugerida: '/intermitentes/aprovacoes',
          },
          detalhe: 'Atraso na validação das horas trabalhadas pelos convocados.',
          isAtrasado: true,
        },
      ],
    },
    {
      id: 'cst-3',
      ordem: 3,
      nome: 'Lote Homologado',
      subtitulo: 'Fechamento Aprovado pelo RH',
      trilhaId: 'trilha-custos',
      trilhaTitulo: 'Trilha B · Mão de Obra & Custos',
      totalProcessos: 5,
      processosEmAtencao: 1,
      situacao: 'bloqueado',
      tempoMedio: '8 horas',
      slaLimite: '12h',
      responsavelSetorial: 'RH',
      resumoSituacao: '1 lote com restrição impeditiva',
      itensExemplo: [
        {
          id: 'item-c3-1',
          codigo: 'FECH-CLT-BAR',
          tipo: 'Fechamento CLT',
          cliente: 'ESC Barueri',
          unidade: 'Matriz Barueri',
          tempoParado: '8h na etapa',
          responsavelSetor: 'RH',
          situacaoCategoria: 'bloqueado',
          situacaoTexto: 'Inconsistência Impeditiva',
          motivo: '2 colaboradores CLT sem batida de retorno de almoço bloqueiam o fechamento da unidade.',
          ctaLabel: 'Resolver inconsistência',
          ctaDestinoTipo: 'inconsistencias',
          ctaContexto: {
            origem: 'torre',
            trilha: 'mao_obra_custos',
            etapa: 'lote_homologado',
            processoId: 'FECH-CLT-BAR',
            rotaSugerida: '/inconsistencias',
          },
          detalhe: 'O fechamento mensal da folha está travado devido a divergências no espelho de ponto.',
          isBloqueado: true,
        },
        {
          id: 'item-c3-2',
          codigo: 'LOT-CST-088',
          tipo: 'Custos Extras',
          cliente: 'Hub Campinas',
          unidade: 'Hub Campinas',
          tempoParado: '3h na etapa',
          responsavelSetor: 'RH',
          situacaoCategoria: 'normal',
          situacaoTexto: 'Lote Homologado',
          motivo: 'Despesas operacionais validadas pelo supervisor e prontas para programação.',
          ctaLabel: 'Abrir detalhes',
          ctaDestinoTipo: 'detalhes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'mao_obra_custos',
            etapa: 'lote_homologado',
            processoId: 'LOT-CST-088',
            rotaSugerida: '/custos-extras/lancamentos',
          },
          detalhe: 'Aguardando apenas o ciclo bancário de liberação.',
        },
      ],
    },
    {
      id: 'cst-4',
      ordem: 4,
      nome: 'Direcionamento Financeiro',
      subtitulo: 'Contas a Pagar & Preparação CNAB',
      trilhaId: 'trilha-custos',
      trilhaTitulo: 'Trilha B · Mão de Obra & Custos',
      totalProcessos: 11,
      processosEmAtencao: 0,
      situacao: 'normal',
      tempoMedio: '1,1 dias',
      slaLimite: '48h',
      responsavelSetorial: 'Financeiro',
      resumoSituacao: 'Programados para liquidação bancária',
      itensExemplo: [
        {
          id: 'item-c4-1',
          codigo: 'REM-CNAB-77',
          tipo: 'Diaristas',
          cliente: 'ESC Consolidado',
          unidade: 'Todas as Unidades',
          tempoParado: '18h na etapa',
          responsavelSetor: 'Financeiro',
          situacaoCategoria: 'normal',
          situacaoTexto: 'Pronto para remessa bancária',
          motivo: 'Lote de pagamentos de 42 diaristas consolidado e validado para arquivo CNAB 240.',
          ctaLabel: 'Abrir detalhes',
          ctaDestinoTipo: 'detalhes',
          ctaContexto: {
            origem: 'torre',
            trilha: 'mao_obra_custos',
            etapa: 'direcionamento_financeiro',
            processoId: 'REM-CNAB-77',
            rotaSugerida: '/bancario?tab=diaristas',
          },
          detalhe: 'Remessa aguardando transmissão bancária na janela das 16h.',
        },
      ],
    },
  ],
};
