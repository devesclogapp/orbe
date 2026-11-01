import { matchPath } from 'react-router-dom';
import { HelpGuideData } from '@/types/contextualHelp';

export const CONTEXTUAL_HELP_CATALOG: HelpGuideData[] = [
  // ==========================================
  // 1. PORTAL OPERACIONAL (ENCARREGADO EM CAMPO)
  // ==========================================
  {
    id: 'producao-operacoes-volume',
    routePattern: '/producao',
    title: 'Lançamento de Operação por Volume',
    category: 'Operações de Campo',
    targetRole: ['ENCARREGADO', 'ADMIN'],
    purpose: 'Registrar as operações de carga, descarga, transbordo ou paletização executadas no turno de trabalho.',
    whenToUse: 'Sempre que uma operação logística for iniciada ou concluída em campo por uma equipe.',
    howItWorks: [
      { step: 1, title: 'Identificação da Operação', description: 'Selecione a empresa contratante, a unidade operacional e informe a placa do veículo/carreta.' },
      { step: 2, title: 'Definição do Serviço e Volume', description: 'Selecione o produto/serviço manipulado, informe o volume exato (toneladas, caixas, pallets) e confira o valor unitário sugerido.' },
      { step: 3, title: 'Equipe e Custos Extras', description: 'Vincule os colaboradores participantes da operação e registre insumos extras utilizados (ex: filme stretch, fita).' },
      { step: 4, title: 'Salvar e Enviar', description: 'Revise os valores totais calculados e confirme o envio para recepção no ERP.' }
    ],
    fieldsAndStatus: [
      { term: 'Volume', explanation: 'Quantidade física movimentada (peso em toneladas, caixas ou paletes), base para cálculo do valor total.', type: 'campo' },
      { term: 'Placa', explanation: 'Identificador do caminhão ou carreta atendida. Essencial para controle e auditoria da empresa.', type: 'campo' },
      { term: 'NF Sim / Não', explanation: 'Indica se a mercadoria possui Nota Fiscal física acompanhando o carregamento/descarga.', type: 'campo' },
      { term: 'Forma de Pagamento', explanation: 'Modalidade financeira acordada (À Vista, Boleto, Faturamento Mensal ou Adiantamento).', type: 'campo' },
      { term: 'Colaboradores Vinculados', explanation: 'Profissionais que participaram fisicamente da execução, permitindo o rateio da produção.', type: 'campo' }
    ],
    checklist: [
      'A empresa e unidade selecionadas correspondem ao local da execução.',
      'A placa do veículo foi informada corretamente sem caracteres especiais.',
      'O volume e a unidade de medida conferem com a nota/romaneio.',
      'Todos os colaboradores que trabalharam na operação foram incluídos.'
    ],
    nextSteps: 'O lançamento é gravado com status "Lançado" e disponibilizado imediatamente na tela de Operações por Volume do ERP para conferência operacional e aprovação do RH.',
    commonIssues: [
      { question: 'A empresa ou serviço não aparece na listagem?', answer: 'Verifique se o cadastro da empresa ou produto está ativo na Central de Cadastros do ERP.' },
      { question: 'Lancei um volume errado, como corrigir?', answer: 'Abra a listagem de operações, localize o registro do turno e clique em editar antes do fechamento do lote pelo RH.' }
    ]
  },
  {
    id: 'producao-diaristas',
    routePattern: '/producao/diaristas',
    title: 'Apontamento Diário de Diaristas',
    category: 'Operações de Campo',
    targetRole: ['ENCARREGADO', 'ADMIN'],
    purpose: 'Registrar a presença, meia-diária ou ausência dos diaristas convocados para os turnos da semana.',
    whenToUse: 'Diariamente no início e término de cada turno, e ao final do ciclo semanal para fechamento.',
    howItWorks: [
      { step: 1, title: 'Seleção da Unidade e Semana', description: 'Selecione a empresa/unidade de atendimento e a semana de competência aberta.' },
      { step: 2, title: 'Marcação dos Códigos', description: 'Para cada colaborador da grade, marque o status do dia: Presença Integral (P), Meia Diária (MP) ou Falta (F).' },
      { step: 3, title: 'Conferência de Valores', description: 'O sistema calcula automaticamente o valor total devido com base na tabela de diária contratada.' },
      { step: 4, title: 'Fechamento da Semana', description: 'Ao concluir todos os dias do ciclo, clique em "Fechar Período" para consolidar o lote semanal.' }
    ],
    fieldsAndStatus: [
      { term: 'P (Presença)', explanation: 'Dia trabalhado integralmente. Recebe o valor total da diária cadastrada.', type: 'status' },
      { term: 'MP (Meia Presença)', explanation: 'Trabalho parcial ou meio expediente. Recebe 50% do valor da diária.', type: 'status' },
      { term: 'F (Falta)', explanation: 'Ausência não justificada. Não gera remuneração no dia.', type: 'status' },
      { term: 'Lote Semanal', explanation: 'Agrupamento oficial dos 7 dias que é submetido para validação do RH e pagamento bancário.', type: 'campo' }
    ],
    checklist: [
      'Todos os dias trabalhados foram preenchidos para cada diarista ativo.',
      'Não há diaristas convocados sem marcação registrada.',
      'Os valores diários conferem com os acordos de cada função.'
    ],
    nextSteps: 'Após clicar em "Fechar Período", o lote é criado e encaminhado para o RH em "Aprovações RH — Diaristas". Após aprovação, segue para o Financeiro gerar a remessa bancária CNAB.',
    commonIssues: [
      { question: 'Um diarista novo não aparece na grade?', answer: 'Ele precisa ser cadastrado previamente em RH > Cadastros de Diaristas com status Ativo.' },
      { question: 'Consigo alterar após clicar em Fechar Período?', answer: 'Não diretamente. Se o período já foi fechado, solicite ao RH a reabertura ou recusa do lote para ajuste.' }
    ]
  },
  {
    id: 'producao-custos-extras',
    routePattern: '/producao/custos-extras',
    title: 'Lançamento de Custos Extras',
    category: 'Operações de Campo',
    targetRole: ['ENCARREGADO', 'ADMIN'],
    purpose: 'Registrar despesas operacionais emergenciais realizadas em campo (lanches, ferramentas, EPIs, combustível, manutenção rápida).',
    whenToUse: 'Sempre que houver um desembolso ou gasto não rotineiro ligado à operação.',
    howItWorks: [
      { step: 1, title: 'Classificação da Despesa', description: 'Selecione a categoria do custo (Alimentação, EPI, Manutenção, Combustível, Outros).' },
      { step: 2, title: 'Vínculo Operacional', description: 'Indique a empresa e unidade onde a despesa ocorreu.' },
      { step: 3, title: 'Valor e Comprovante', description: 'Informe o valor exato gasto e descreva o motivo da compra com detalhes.' },
      { step: 4, title: 'Confirmação', description: 'Salve o registro para envio à triagem operacional e aprovação.' }
    ],
    fieldsAndStatus: [
      { term: 'Categoria', explanation: 'Classificação contábil da despesa para composição do DRE e margem da operação.', type: 'campo' },
      { term: 'Reembolsável', explanation: 'Indica se o valor foi pago do bolso do encarregado e deve ser ressarcido.', type: 'campo' },
      { term: 'Pendente RH/Financeiro', explanation: 'Status inicial aguardando conferência de recibo e autorização.', type: 'status' }
    ],
    checklist: [
      'A descrição explica claramente a necessidade do gasto.',
      'O valor informado confere com o cupom/nota fiscal obtido.',
      'A empresa destino do custo foi selecionada corretamente.'
    ],
    nextSteps: 'O custo aparece na tela de Recepção de Custos Extras do ERP para conferência e posterior liberação de pagamento pelo Financeiro.',
    commonIssues: [
      { question: 'O encarregado precisa do reembolso imediato?', answer: 'Informe a opção de adiantamento/reembolso no campo de observação para priorização financeira.' }
    ]
  },
  {
    id: 'producao-servicos-extras',
    routePattern: '/producao/servicos-extras',
    title: 'Lançamento de Serviços Extras',
    category: 'Operações de Campo',
    targetRole: ['ENCARREGADO', 'ADMIN'],
    purpose: 'Apontar serviços extraordinários não inclusos no contrato padrão (conserto de pallets, recondicionamento, transbordo manual, apoio logístico).',
    whenToUse: 'Quando o cliente solicitar uma atividade adicional que gera faturamento extra ou remuneração adicional à equipe.',
    howItWorks: [
      { step: 1, title: 'Identificação do Serviço', description: 'Selecione o tipo de serviço extraordinário executado.' },
      { step: 2, title: 'Quantidade e Unidade', description: 'Informe as unidades entregues (ex: quantidade de pallets consertados ou horas de apoio).' },
      { step: 3, title: 'Colaboradores Envolvidos', description: 'Selecione a equipe responsável pela entrega do serviço.' },
      { step: 4, title: 'Envio', description: 'Confirme para gerar a medição operacional correspondente.' }
    ],
    fieldsAndStatus: [
      { term: 'Faturável ao Cliente', explanation: 'Define se o serviço extra será cobrado na fatura do cliente.', type: 'campo' },
      { term: 'Remuneração Adicional', explanation: 'Define se o valor gera rateio/pagamento extra para os colaboradores.', type: 'campo' }
    ],
    checklist: [
      'O serviço foi autorizado pelo encarregado ou supervisor da empresa contratante.',
      'A quantidade executada foi conferida fisicamente antes de salvar.'
    ],
    nextSteps: 'O registro cai na fila de Serviços Extras Recebidos para validação pelo RH e consolidação no faturamento.',
    commonIssues: [
      { question: 'O serviço não consta na lista?', answer: 'Cadastre o novo tipo de serviço na Central de Cadastros > Serviços.' }
    ]
  },
  {
    id: 'producao-servicos-especificos',
    routePattern: '/producao/servicos-especificos',
    title: 'Lançamento de Serviços Específicos',
    category: 'Operações de Campo',
    targetRole: ['ENCARREGADO', 'ADMIN'],
    purpose: 'Lançar operações especiais tabeladas por códigos fixos (ex: CN5C - Carregamento Noturno 5 Colaboradores, N1, N2).',
    whenToUse: 'Em turnos noturnos ou operações com regras específicas de precificação tabelada por equipe.',
    howItWorks: [
      { step: 1, title: 'Seleção do Código', description: 'Escolha o código tabelado correspondente à operação (ex: CN5C, CN4C).' },
      { step: 2, title: 'Período e Equipe', description: 'Informe o turno/período (N1, N2) e relacione os colaboradores participantes.' },
      { step: 3, title: 'Cálculo Automático', description: 'O sistema calcula o valor fixo contratado a faturar e pagar.' },
      { step: 4, title: 'Gravação', description: 'Salve para compor o fechamento da escala operacional.' }
    ],
    fieldsAndStatus: [
      { term: 'Código do Serviço', explanation: 'Identificador padronizado da regra operacional cadastrada no sistema.', type: 'campo' },
      { term: 'Período Noturno', explanation: 'Faixa horária de execução que define os adicionais contratuais aplicáveis.', type: 'campo' }
    ],
    checklist: [
      'A quantidade de colaboradores bate exatamente com o código selecionado.',
      'O período noturno condiz com o horário real da execução.'
    ],
    nextSteps: 'Integrado automaticamente ao fechamento operacional e espelho de faturamento.',
    commonIssues: [
      { question: 'A equipe teve quantidade diferente da regra do código?', answer: 'Utilize o código compatível com a quantidade real de colaboradores presentes.' }
    ]
  },

  // ==========================================
  // 2. OPERAÇÕES DE CAMPO / TORRE (BACKOFFICE)
  // ==========================================
  {
    id: 'operacoes-volume-gestao',
    routePattern: '/operacoes-volume',
    title: 'Recepção e Gestão de Operações por Volume',
    category: 'Operações de Campo',
    targetRole: ['ADMIN', 'RH', 'FINANCEIRO'],
    purpose: 'Gerenciar, auditar e conferir todas as operações de volume enviadas pelos encarregados antes da homologação final.',
    whenToUse: 'Diariamente para conferência dos volumes lançados, ajuste de divergências e triagem de faturamento.',
    howItWorks: [
      { step: 1, title: 'Filtros e Busca', description: 'Filtre por período, empresa contratante, unidade ou status do lançamento.' },
      { step: 2, title: 'Inspeção do Registro', description: 'Clique na linha para expandir a equipe vinculada, comprovantes e valores calculados.' },
      { step: 3, title: 'Edição de Inconsistências', description: 'Caso necessário, ajuste placas, notas fiscais ou colaboradores antes de submeter ao RH.' },
      { step: 4, title: 'Submissão / Homologação', description: 'Aprove os registros validados para encaminhamento ao faturamento e DRE.' }
    ],
    fieldsAndStatus: [
      { term: 'LANÇADO', explanation: 'Registro gravado pelo encarregado em campo, aguardando conferência do backoffice.', type: 'status' },
      { term: 'AGUARDANDO_RH', explanation: 'Operação conferida pela operação, aguardando validação das horas e rateio pelo RH.', type: 'status' },
      { term: 'APROVADO_RH', explanation: 'Validado pelo RH, liberado para contas a receber e faturamento.', type: 'status' },
      { term: 'Valor Bruto vs Líquido', explanation: 'Valor Bruto = volume x preço unitário. Líquido = bruto deduzido de impostos/custos.', type: 'campo' }
    ],
    checklist: [
      'Nenhum registro com campos vitais nulos (empresa, unidade ou volume zerado).',
      'Colaboradores vinculados conferem com o registro de presença da data.',
      'Valores unitários respeitam a tabela de preços ativa da empresa.'
    ],
    nextSteps: 'Registros validados alimentam o pipeline de Receitas Operacionais, gerando as medições para cobrança e faturamento mensal ou à vista.',
    commonIssues: [
      { question: 'Registro aparece sem colaboradores vinculados?', answer: 'Abra a edição do lançamento e adicione os membros da equipe que atuaram na descarga.' }
    ]
  },
  {
    id: 'torre-operacional-pipeline',
    routePattern: '/operacional/pipeline',
    title: 'Torre de Controle Operacional (Pipeline)',
    category: 'Operações de Campo',
    targetRole: ['ADMIN', 'RH', 'FINANCEIRO'],
    purpose: 'Visualizar o fluxo ponta a ponta dos lançamentos operacionais, identificando gargalos, SLAs e valores represados em cada etapa.',
    whenToUse: 'Para monitorar a saúde da operação em tempo real e identificar bloqueios antes dos prazos de fechamento.',
    howItWorks: [
      { step: 1, title: 'Análise de Gargalos', description: 'Observe os funis por etapa (Campo -> Validação RH -> Aprovação Financeira -> Pagamento/Faturamento).' },
      { step: 2, title: 'Identificação de Retenções', description: 'Consulte os cards de valores acumulados e itens com SLA vencido.' },
      { step: 3, title: 'Ação Direta', description: 'Clique no estágio com pendências para abrir diretamente a fila de resolução.' }
    ],
    fieldsAndStatus: [
      { term: 'SLA Médio', explanation: 'Tempo médio decorrido entre o lançamento em campo e a conclusão financeira.', type: 'indicador' },
      { term: 'Valor Represado', explanation: 'Montante financeiro que ainda não concluiu todas as etapas de homologação.', type: 'indicador' }
    ],
    checklist: [
      'Não permitir itens acumulados por mais de 48h na etapa de validação.',
      'Verificar se há divergências entre o total do campo e os lotes gerados.'
    ],
    nextSteps: 'Atue nos gargalos acionando os responsáveis de cada setor (Operação, RH ou Financeiro).',
    commonIssues: [
      { question: 'Os números da torre parecem defasados?', answer: 'Clique no botão de atualizar no topo da tela para recarregar as métricas mais recentes.' }
    ]
  },
  {
    id: 'operacional-dashboard',
    routePattern: '/operacional/dashboard',
    title: 'Dashboard Executivo Operacional',
    category: 'Operações de Campo',
    targetRole: ['ADMIN', 'RH', 'FINANCEIRO'],
    purpose: 'Oferecer aos gestores uma visão consolidada de produtividade, volumes movimentados, custos e faturamento projetado.',
    whenToUse: 'No início e término do dia para acompanhamento dos principais KPIs operacionais.',
    howItWorks: [
      { step: 1, title: 'Visão Geral dos KPIs', description: 'Acompanhe volume total diário/mensal, diárias lançadas e despesas operacionais.' },
      { step: 2, title: 'Desempenho por Unidade', description: 'Compare a produtividade entre as diferentes unidades e clientes atendidos.' },
      { step: 3, title: 'Alertas Críticos', description: 'Verifique avisos de inconsistências ou prazos bancários próximos do encerramento.' }
    ],
    fieldsAndStatus: [
      { term: 'Volume Total (ton/cx)', explanation: 'Soma física de todas as cargas movimentadas no período.', type: 'indicador' },
      { term: 'Taxa de Produtividade', explanation: 'Volume movimentado por colaborador ativo no período.', type: 'indicador' }
    ],
    checklist: [
      'Garantir que a base selecionada (Produção ou Homologação) é a correta no seletor do topo.',
      'Verificar se o filtro de data reflete a competência que deseja analisar.'
    ],
    nextSteps: 'Use os dados estratégicos para alocação de equipe e negociação comercial com os clientes.',
    commonIssues: [
      { question: 'Gráficos vazios?', answer: 'Verifique se há lançamentos no período filtrado ou selecione um intervalo de datas maior.' }
    ]
  },
  {
    id: 'central-operacional',
    routePattern: '/central',
    title: 'Central Operacional Unificada',
    category: 'Operações de Campo',
    targetRole: ['ADMIN', 'RH', 'FINANCEIRO', 'ENCARREGADO'],
    purpose: 'Hub central de atalhos rápidos e visão das operações de campo ativas no sistema.',
    whenToUse: 'Como ponto de partida para navegar entre os módulos de volume, diaristas, serviços e custos extras.',
    howItWorks: [
      { step: 1, title: 'Escolha do Módulo', description: 'Clique no card da atividade desejada (Volume, Diaristas, Serviços Extras, etc.).' },
      { step: 2, title: 'Status dos Lotes', description: 'Confira os resumos de itens pendentes de atenção imediata.' }
    ],
    fieldsAndStatus: [
      { term: 'Acesso Rápido', explanation: 'Atalhos direcionados às telas operacionais mais frequentes.', type: 'campo' }
    ],
    checklist: ['Verificar se todas as áreas sob sua responsabilidade estão em dia.'],
    nextSteps: 'Acesse o módulo específico para tratar os lançamentos pendentes.',
    commonIssues: []
  },

  // ==========================================
  // 3. PESSOAS & RH
  // ==========================================
  {
    id: 'clt-pontos-jornadas',
    routePattern: '/clt/pontos',
    title: 'Ponto & Jornadas CLT Oficial',
    category: 'Pessoas & RH',
    targetRole: ['ADMIN', 'RH'],
    purpose: 'Conferir o espelho diário de pontos dos colaboradores CLT, registrar justificativas, ocorrências e preparar o cálculo de jornada.',
    whenToUse: 'Diariamente após a importação automática das 07h dos coletores REP/RHID e no fechamento da folha.',
    howItWorks: [
      { step: 1, title: 'Importação e Sincronização', description: 'Os pontos chegam automaticamente às 07h. É possível forçar reimportação manual caso necessário.' },
      { step: 2, title: 'Análise de Batidas', description: 'Verifique as 4 marcações diárias (Entrada, Saída Almoço, Retorno Almoço e Saída Final).' },
      { step: 3, title: 'Tratamento de Ocorrências', description: 'Para marcações ímpares, faltas ou atrasos, clique na linha para justificar ou anexar atestado.' },
      { step: 4, title: 'Aprovação de Jornada', description: 'Aprove as jornadas conferidas para disponibilização no Motor de Banco de Horas.' }
    ],
    fieldsAndStatus: [
      { term: '4 Batidas Oficiais', explanation: 'E1 (Entrada manhã), S1 (Saída almoço), E2 (Retorno almoço) e S2 (Saída final).', type: 'campo' },
      { term: 'Batida Incompleta', explanation: 'Quando faltou registrar alguma das 4 marcações obrigatórias.', type: 'status' },
      { term: 'Tolerância Legal', explanation: 'Variação de até 10 minutos diários (5 min por marcação) não considerada como atraso ou extra.', type: 'regra' },
      { term: 'Saldo Diário', explanation: 'Diferença entre as horas trabalhadas e a carga horária contratual (ex: 8h48 ou 7h20).', type: 'indicador' }
    ],
    checklist: [
      'Todas as ocorrências do dia anterior foram tratadas ou justificadas.',
      'Não há colaboradores com batidas ímpares não resolvidas.',
      'Os atestados médicos apresentados foram devidamente anexados.'
    ],
    nextSteps: 'Os pontos aprovados alimentam o extrato de Banco de Horas e o cálculo de Horas Extras e Adicional Noturno para a folha mensal.',
    commonIssues: [
      { question: 'Colaborador esqueceu de bater o ponto?', answer: 'Clique no dia correspondente, selecione a ocorrência "Esquecimento de Marcação" e insira a justificativa autorizada.' },
      { question: 'Aparecem pontos duplicados?', answer: 'O sistema realiza a desduplicação por matrícula e timestamp. Verifique se há batidas com menos de 2 minutos de diferença.' }
    ]
  },
  {
    id: 'banco-horas-painel',
    routePattern: '/clt/banco-horas',
    title: 'Painel Geral de Banco de Horas',
    category: 'Pessoas & RH',
    targetRole: ['ADMIN', 'RH'],
    purpose: 'Acompanhar o saldo acumulado de horas de cada colaborador CLT, controlar limites legais e definir compensações.',
    whenToUse: 'Semanalmente para gestão de sobrejornada e mensalmente para o fechamento de folha.',
    howItWorks: [
      { step: 1, title: 'Consulta de Saldos', description: 'Visualize o saldo positivo (crédito) ou negativo (débito) de cada funcionário.' },
      { step: 2, title: 'Filtro por Limite de Risco', description: 'Identifique colaboradores próximos do limite máximo de horas acumuladas permitido pela convenção.' },
      { step: 3, title: 'Extrato Detalhado', description: 'Clique em um colaborador para abrir o extrato dia a dia com créditos, débitos e compensações.' },
      { step: 4, title: 'Ajuste ou Liquidação', description: 'Defina se as horas excedentes serão compensadas em folga ou pagas como hora extra.' }
    ],
    fieldsAndStatus: [
      { term: 'Saldo Positivo', explanation: 'Horas trabalhadas além da jornada que serão compensadas ou pagas com adicional.', type: 'indicador' },
      { term: 'Saldo Negativo', explanation: 'Horas devidas por atrasos ou saídas antecipadas a serem compensadas ou descontadas.', type: 'indicador' },
      { term: 'Compensação', explanation: 'Utilização do saldo positivo para folgas combinadas sem desconto salarial.', type: 'regra' }
    ],
    checklist: [
      'Verificar se há saldos positivos acima do teto acordado no Acordo Coletivo.',
      'Validar que os feriados trabalhados foram calculados com o multiplicador correto (100%).'
    ],
    nextSteps: 'No fechamento mensal, o saldo residual aprovado é enviado para o sistema de folha de pagamento.',
    commonIssues: [
      { question: 'Como abater horas com folga?', answer: 'Acesse o extrato do colaborador e lance a folga compensatória aprovada.' }
    ]
  },
  {
    id: 'banco-horas-fechamento',
    routePattern: '/banco-horas/fechamento',
    title: 'Fechamento Mensal CLT',
    category: 'Pessoas & RH',
    targetRole: ['ADMIN', 'RH'],
    purpose: 'Fechar oficialmente a competência mensal de pontos, congelar saldos de banco de horas e gerar o resumo para folha.',
    whenToUse: 'Ao final do ciclo mensal de apuração (geralmente entre o dia 20 e 25 de cada mês).',
    howItWorks: [
      { step: 1, title: 'Conferência de Pendências', description: 'Certifique-se de que não há pontos ou inconsistências em aberto na competência.' },
      { step: 2, title: 'Simulação do Fechamento', description: 'Gere a prévia com totais de Horas Extras (50% e 100%), Adicional Noturno e DSR.' },
      { step: 3, title: 'Aprovação do RH', description: 'Confirme os cálculos e feche o ciclo para imutabilidade dos dados.' },
      { step: 4, title: 'Exportação', description: 'Exporte o relatório ou arquivo de integração para a folha contábil.' }
    ],
    fieldsAndStatus: [
      { term: 'Competência', explanation: 'Mês e ano de referência da apuração da jornada (ex: 10/2026).', type: 'campo' },
      { term: 'FECHADO', explanation: 'Status imutável que impede qualquer alteração retroativa nos pontos do período.', type: 'status' }
    ],
    checklist: [
      'Todas as ocorrências e atestados do mês foram aprovados.',
      'Nenhum colaborador com apuração incompleta ou zerada indevidamente.'
    ],
    nextSteps: 'Dados exportados para a contabilidade e arquivos arquivados na trilha de auditoria do sistema.',
    commonIssues: [
      { question: 'Preciso corrigir um ponto de um mês já fechado?', answer: 'Utilize a tela de Reprocessamentos com justificativa formal registrada na auditoria.' }
    ]
  },
  {
    id: 'rh-diaristas-painel',
    routePattern: '/operacional/diaristas',
    title: 'Gestão de Diaristas (Painel Geral)',
    category: 'Pessoas & RH',
    targetRole: ['ADMIN', 'RH'],
    purpose: 'Supervisionar a escala, os lançamentos semanais e os pagamentos acumulados dos profissionais diaristas.',
    whenToUse: 'Semanalmente para acompanhamento das escalas e preparação dos lotes de pagamento.',
    howItWorks: [
      { step: 1, title: 'Visão Geral das Semanas', description: 'Consulte os períodos semanais ativos e seus status (Aberto, Em Validação, Aprovado, Pago).' },
      { step: 2, title: 'Detalhes do Lote', description: 'Abra um lote para visualizar os diaristas relacionados, dias trabalhados e valores a pagar.' },
      { step: 3, title: 'Envio para Aprovação', description: 'Concluída a conferência, aprove o lote para seguir ao Financeiro.' }
    ],
    fieldsAndStatus: [
      { term: 'Semana Operacional', explanation: 'Ciclo de 7 dias (segunda a domingo) em que as diárias são acumuladas para pagamento.', type: 'campo' },
      { term: 'AGUARDANDO_RH', explanation: 'Semana fechada pelo encarregado, pronta para análise e auditoria do RH.', type: 'status' }
    ],
    checklist: [
      'Quantidade de diárias declaradas bate com os relatórios das portarias/unidades.',
      'Dados bancários (chave PIX ou conta) de todos os diaristas estão preenchidos.'
    ],
    nextSteps: 'Após aprovação no RH, o lote segue automaticamente para a fila de Despesas do Financeiro para inclusão na remessa CNAB.',
    commonIssues: [
      { question: 'Diarista sem dados bancários cadastrados?', answer: 'Acesse RH > Cadastros de Diaristas e complete o cadastro antes de aprovar o lote.' }
    ]
  },
  {
    id: 'rh-diaristas-cadastros',
    routePattern: '/rh/diaristas/cadastros',
    title: 'Cadastros e Gestão de Diaristas',
    category: 'Pessoas & RH',
    targetRole: ['ADMIN', 'RH'],
    purpose: 'Cadastrar e manter atualizados os dados pessoais, documentos e informações bancárias dos diaristas.',
    whenToUse: 'Sempre que um novo diarista for contratado ou quando houver alteração de dados bancários/PIX.',
    howItWorks: [
      { step: 1, title: 'Novo Cadastro', description: 'Clique em "Novo Diarista" e informe Nome, CPF, Telefone e Função.' },
      { step: 2, title: 'Dados Bancários', description: 'Cadastre a Chave PIX (preferencialmente CPF) ou dados completos de Conta Corrente.' },
      { step: 3, title: 'Valor da Diária', description: 'Defina o valor base da diária ou vincule à tabela padrão da função.' },
      { step: 4, title: 'Ativação', description: 'Mantenha o status "Ativo" para que o nome apareça na grade do Encarregado.' }
    ],
    fieldsAndStatus: [
      { term: 'Chave PIX', explanation: 'Chave principal para pagamento semanal sem tarifas bancárias.', type: 'campo' },
      { term: 'Status Ativo/Inativo', explanation: 'Apenas diaristas ativos aparecem nas opções de marcação do encarregado.', type: 'status' }
    ],
    checklist: [
      'CPF validado e sem pontuação divergente.',
      'Chave PIX confirmada com o próprio colaborador para evitar estornos bancários.'
    ],
    nextSteps: 'O diarista fica imediatamente disponível para escalação pelo encarregado na grade de produção.',
    commonIssues: [
      { question: 'Diarista não quer mais prestar serviços?', answer: 'Altere o status para Inativo para preservar o histórico sem poluir a grade atual.' }
    ]
  },
  {
    id: 'rh-intermitentes-gestao',
    routePattern: '/operacional/intermitentes',
    title: 'Gestão de Trabalhadores Intermitentes',
    category: 'Pessoas & RH',
    targetRole: ['ADMIN', 'RH'],
    purpose: 'Controlar as convocações formais, prazos de aceite, jornadas e pagamentos de colaboradores sob contrato intermitente.',
    whenToUse: 'Na convocação prévia (mínimo 72h antes) e na apuração pós-jornada para pagamento em até 5 dias.',
    howItWorks: [
      { step: 1, title: 'Convocação', description: 'Registre a convocação com antecedência legal informando local, horário e remuneração.' },
      { step: 2, title: 'Confirmação de Aceite', description: 'O colaborador tem 24h para aceitar ou recusar a convocação formal.' },
      { step: 3, title: 'Registro da Jornada', description: 'Apure o total de horas executadas no período da convocação.' },
      { step: 4, title: 'Geração de Lote', description: 'Gere o lote de pagamento com discriminação de DSR, férias proporcionais e 13º.' }
    ],
    fieldsAndStatus: [
      { term: 'Convocação', explanation: 'Chamado formal obrigatório para trabalho intermitente conforme CLT Art. 452-A.', type: 'campo' },
      { term: 'Recibo Proporcional', explanation: 'Demonstrativo obrigatório contendo salário, férias + 1/3, 13º e DSR discriminados.', type: 'campo' }
    ],
    checklist: [
      'Prazo legal de 72h de antecedência respeitado na convocação.',
      'Discriminação exata das verbas reflexas (DSR, 13º e Férias) no demonstrativo.'
    ],
    nextSteps: 'O lote aprovado segue para o Financeiro emitir a remessa bancária dentro do prazo estipulado.',
    commonIssues: [
      { question: 'Colaborador não compareceu após aceitar?', answer: 'Registre o não comparecimento injustificado na ocorrência da convocação.' }
    ]
  },

  // ==========================================
  // 4. APROVAÇÕES & FECHAMENTO
  // ==========================================
  {
    id: 'rh-aprovacoes-central',
    routePattern: '/rh/aprovacoes',
    title: 'Central Unificada de Aprovações RH',
    category: 'Aprovações & Fechamento',
    targetRole: ['ADMIN', 'RH'],
    purpose: 'Canal oficial e unificado onde o RH valida, aprova ou devolve lotes operacionais (Diaristas, Intermitentes, Operações por Volume, Serviços e Custos Extras).',
    whenToUse: 'Diariamente ou conforme fechamento dos ciclos operacionais antes do repasse ao Financeiro.',
    howItWorks: [
      { step: 1, title: 'Seleção do Fluxo', description: 'Navegue entre as abas (Diaristas, Intermitentes, Operações, Serviços Extras, Custos Extras).' },
      { step: 2, title: 'Conferência do Lote', description: 'Clique em um lote para inspecionar os lançamentos individuais, horas, pessoas e valores.' },
      { step: 3, title: 'Aprovação ou Devolução', description: 'Clique em "Aprovar Lote" para liberar ao Financeiro, ou "Devolver" informando o motivo para correção.' }
    ],
    fieldsAndStatus: [
      { term: 'AGUARDANDO_RH', explanation: 'Lote submetido pela operação de campo aguardando conferência detalhada.', type: 'status' },
      { term: 'APROVADO_RH', explanation: 'Lote homologado pelo RH, pronto para integração no Contas a Pagar.', type: 'status' },
      { term: 'DEVOLVIDO', explanation: 'Lote retornado ao encarregado com justificativa para correção dos dados.', type: 'status' }
    ],
    checklist: [
      'Conferir se os valores individuais conferem com a tabela vigente.',
      'Certificar-se de que não há dados bancários em falta no lote.',
      'Em caso de devolução, fornecer justificativa clara e objetiva.'
    ],
    nextSteps: 'Lotes aprovados criam automaticamente os títulos no módulo Financeiro de Despesas e Contas a Pagar.',
    commonIssues: [
      { question: 'Posso aprovar itens parciais dentro do lote?', answer: 'Recomenda-se aprovar o lote integralmente ou devolver ao encarregado para excluir/corrigir o item incorreto.' }
    ]
  },
  {
    id: 'inconsistencias-central',
    routePattern: '/inconsistencias',
    title: 'Central Geral de Inconsistências',
    category: 'Aprovações & Fechamento',
    targetRole: ['ADMIN', 'RH', 'FINANCEIRO'],
    purpose: 'Identificar automaticamente anomalias cadastrais, divergências de jornada, batidas órfãs e inconsistências financeiras.',
    whenToUse: 'Regularmente para saneamento contínuo da base e prevenção de erros em fechamentos.',
    howItWorks: [
      { step: 1, title: 'Triagem de Alertas', description: 'Analise as inconsistências agrupadas por criticidade (Crítico, Médio, Baixo).' },
      { step: 2, title: 'Localização da Raiz', description: 'Verifique o colaborador, empresa ou lote apontado pelo motor de validação.' },
      { step: 3, title: 'Ação de Correção', description: 'Clique no atalho direto para resolver o cadastro, justificar o ponto ou reprocessar o cálculo.' }
    ],
    fieldsAndStatus: [
      { term: 'Criticidade Alta', explanation: 'Impede o fechamento de folha ou envio de remessa bancária (ex: CPF inválido, dados bancários nulos).', type: 'indicador' },
      { term: 'Criticidade Média', explanation: 'Divergência de horário ou batida ímpar que requer justificativa.', type: 'indicador' }
    ],
    checklist: [
      'Zerar todas as inconsistências de criticidade alta antes de fechar a semana ou mês.'
    ],
    nextSteps: 'Após resolver a causa raiz, a inconsistência desaparece automaticamente da fila.',
    commonIssues: []
  },
  {
    id: 'fechamento-ciclos',
    routePattern: '/fechamento',
    title: 'Fechamento de Ciclos',
    category: 'Aprovações & Fechamento',
    targetRole: ['ADMIN', 'RH', 'FINANCEIRO'],
    purpose: 'Controlar os períodos de apuração do ERP (Semanas Diaristas, Quinzenas Intermitentes, Competências Mensais CLT e Faturamento).',
    whenToUse: 'Para abrir novos ciclos ou encerrar formalmente ciclos vigentes com trava de edição.',
    howItWorks: [
      { step: 1, title: 'Seleção do Domínio', description: 'Escolha se deseja gerenciar ciclos de Diaristas, CLT ou Faturamento.' },
      { step: 2, title: 'Status do Período', description: 'Verifique se o período está Aberto, Em Apuração ou Concluído.' },
      { step: 3, title: 'Trava do Ciclo', description: 'Ao fechar o ciclo, nenhum lançamento com data dentro do período poderá ser criado ou editado sem autorização.' }
    ],
    fieldsAndStatus: [
      { term: 'Ciclo Aberto', explanation: 'Período liberado para lançamentos diários normais.', type: 'status' },
      { term: 'Ciclo Fechado', explanation: 'Período trancado para garantir imutabilidade e integridade contábil.', type: 'status' }
    ],
    checklist: [
      'Todos os lotes do período foram processados antes de travar o ciclo.'
    ],
    nextSteps: 'Gera as bases definitivas para emissão de notas fiscais e relatórios gerenciais.',
    commonIssues: []
  },

  // ==========================================
  // 5. FINANCEIRO & CONTROLADORIA
  // ==========================================
  {
    id: 'financeiro-receitas',
    routePattern: '/financeiro/receitas',
    title: 'Pipeline de Receitas Operacionais',
    category: 'Financeiro & Controladoria',
    targetRole: ['ADMIN', 'FINANCEIRO'],
    purpose: 'Gerenciar o ciclo completo de receitas a partir das operações de campo: da execução ao faturamento, emissão de cobranças, recebimento e conciliação.',
    whenToUse: 'Diariamente para acompanhar entradas operacionais e emitir cobranças à vista, boletos ou faturas mensais.',
    howItWorks: [
      { step: 1, title: 'Recepção de Operações', description: 'Consulte os serviços executados em campo e homologados pelo RH.' },
      { step: 2, title: 'Classificação Financeira', description: 'Direcione para Caixa Imediato (à vista), Duplicatas ou Faturamento Mensal consolidado.' },
      { step: 3, title: 'Geração de Cobrança', description: 'Gere a medição oficial, emita a fatura ou boleto para envio ao cliente.' },
      { step: 4, title: 'Baixa e Conciliação', description: 'Registre o recebimento bancário via extrato ou PIX, concluindo o ciclo da receita.' }
    ],
    fieldsAndStatus: [
      { term: 'Receita Executada', explanation: 'Serviço prestado em campo, registrado e conferido, aguardando faturamento.', type: 'status' },
      { term: 'Faturado / Em Cobrança', explanation: 'Fatura emitida com vencimento acordado, aguardando liquidação.', type: 'status' },
      { term: 'Recebido / Conciliado', explanation: 'Valor creditado na conta da empresa e conferido no extrato bancário.', type: 'status' }
    ],
    checklist: [
      'Valores de ISS e retenções foram deduzidos conforme regras contratuais da empresa.',
      'A data de vencimento respeita o prazo cadastrado para o cliente.'
    ],
    nextSteps: 'A receita liquidada compõe o fluxo de caixa real e alimenta a DRE Operacional.',
    commonIssues: [
      { question: 'Cliente pagou via PIX sem boleto?', answer: 'Realize a baixa direta informando a conta bancária de destino e o código do comprovante.' }
    ]
  },
  {
    id: 'financeiro-despesas',
    routePattern: '/financeiro',
    title: 'Despesas & Contas a Pagar',
    category: 'Financeiro & Controladoria',
    targetRole: ['ADMIN', 'FINANCEIRO'],
    purpose: 'Gerenciar os pagamentos devidos aos colaboradores (Diaristas, Intermitentes, CLT), fornecedores e custos extras aprovados pelo RH.',
    whenToUse: 'Para conferência de contas a pagar, aprovação financeira e liberação para geração de remessa bancária.',
    howItWorks: [
      { step: 1, title: 'Fila de Contas', description: 'Consulte os lotes RH aprovados e títulos de fornecedores a vencer.' },
      { step: 2, title: 'Aprovação Financeira', description: 'Confira os totais, valide a disponibilidade de caixa e aprove o pagamento.' },
      { step: 3, title: 'Agrupamento em Lote Bancário', description: 'Envie os títulos aprovados para a fila de remessa CNAB240.' }
    ],
    fieldsAndStatus: [
      { term: 'APROVADO_RH', explanation: 'Título validado pelo RH, aguardando autorização de pagamento pelo Financeiro.', type: 'status' },
      { term: 'LIBERADO_PAGAMENTO', explanation: 'Autorizado financeiramente para compor o próximo lote bancário.', type: 'status' },
      { term: 'PAGO', explanation: 'Valor liquidado via retorno bancário ou baixa manual com comprovante.', type: 'status' }
    ],
    checklist: [
      'Saldo em conta suficiente para a liquidação do lote na data prevista.',
      'Conferir se há cobrança de impostos retidos na fonte a provisionar.'
    ],
    nextSteps: 'Os títulos liberados são enviados para a tela de Remessa CNAB para envio ao banco.',
    commonIssues: []
  },
  {
    id: 'financeiro-bancario-central',
    routePattern: '/bancario',
    title: 'Central Bancária Unificada',
    category: 'Financeiro & Controladoria',
    targetRole: ['ADMIN', 'FINANCEIRO'],
    purpose: 'Ponto focal para operação com bancos parceiros: geração de remessas CNAB240, importação de retornos e saldos.',
    whenToUse: 'Nos dias de pagamento (semanais para diaristas e quinzenais/mensais para os demais).',
    howItWorks: [
      { step: 1, title: 'Seleção da Conta', description: 'Selecione o banco e a conta de débito conveniada.' },
      { step: 2, title: 'Geração da Remessa', description: 'Clique em "Gerar Remessa" para baixar o arquivo .REM padronizado.' },
      { step: 3, title: 'Transmissão ao Banco', description: 'Envie o arquivo no Internet Banking do seu banco.' },
      { step: 4, title: 'Importação do Retorno', description: 'Após o processamento bancário, baixe o arquivo .RET e importe nesta tela para conciliação automática.' }
    ],
    fieldsAndStatus: [
      { term: 'CNAB 240', explanation: 'Padrão Febraban de arquivo para pagamento em lote (PIX, TED ou Transferência).', type: 'campo' },
      { term: 'Arquivo .REM', explanation: 'Remessa gerada pelo ERP enviada ao banco para agendar os pagamentos.', type: 'campo' },
      { term: 'Arquivo .RET', explanation: 'Retorno gerado pelo banco informando quais pagamentos foram liquidados ou rejeitados.', type: 'campo' }
    ],
    checklist: [
      'O número sequencial de remessa está em ordem crescente sem repetições.',
      'A conta bancária utilizada possui convênio ativo para o serviço de pagamento a fornecedores.'
    ],
    nextSteps: 'A importação do retorno marca os lotes como "PAGOS" e encerra o pipeline das despesas.',
    commonIssues: [
      { question: 'O banco rejeitou um pagamento no retorno?', answer: 'Consulte o código de ocorrência do retorno bancário (ex: chave PIX inexistente ou conta encerrada) e ajuste o cadastro.' }
    ]
  },
  {
    id: 'financeiro-faturamento',
    routePattern: '/financeiro/faturamento',
    title: 'Faturamento por Cliente',
    category: 'Financeiro & Controladoria',
    targetRole: ['ADMIN', 'FINANCEIRO'],
    purpose: 'Consolidar as medições mensais de cada cliente contratante, emitir memórias de cálculo detalhadas e gerar faturas.',
    whenToUse: 'No período de fechamento mensal comercial para faturamento das empresas atendidas.',
    howItWorks: [
      { step: 1, title: 'Seleção do Cliente e Mês', description: 'Escolha a empresa e o mês de competência a apurar.' },
      { step: 2, title: 'Consolidação das Medições', description: 'O sistema lista todas as operações por volume, serviços extras e específicos realizados.' },
      { step: 3, title: 'Conferência de Descontos e Impostos', description: 'Aplique regras de retenção técnica ou ISS conforme contrato.' },
      { step: 4, title: 'Emissão da Fatura', description: 'Gere a fatura oficial com o detalhamento das cargas para envio ao cliente.' }
    ],
    fieldsAndStatus: [
      { term: 'Memória de Faturamento', explanation: 'Relatório discriminado de todas as cargas, placas e datas que compõem o valor cobrado.', type: 'campo' },
      { term: 'Retenção Técnica', explanation: 'Percentual retido contratualmente pelo tomador do serviço quando aplicável.', type: 'campo' }
    ],
    checklist: [
      'Todas as operações do cliente na competência estão homologadas.',
      'Valores unitários e alíquotas de impostos batem com a proposta comercial.'
    ],
    nextSteps: 'Envie a fatura e a memória ao cliente para aprovação no Portal do Cliente ou por e-mail.',
    commonIssues: []
  },
  {
    id: 'financeiro-dre',
    routePattern: '/financeiro/dre',
    title: 'Resultado Operacional (DRE)',
    category: 'Financeiro & Controladoria',
    targetRole: ['ADMIN', 'FINANCEIRO'],
    purpose: 'Analisar o Demonstrativo de Resultado do Exercício por cliente, unidade e empresa global.',
    whenToUse: 'Para análise de lucratividade, margem de contribuição e tomada de decisão estratégica.',
    howItWorks: [
      { step: 1, title: 'Filtro de Período', description: 'Selecione o mês ou trimestre desejado e filtre por empresa/unidade.' },
      { step: 2, title: 'Análise da Receita Bruta', description: 'Visualize o faturamento total gerado pelas operações.' },
      { step: 3, title: 'Dedução de Custos Diretos', description: 'Examine gastos com mão de obra (CLT, diaristas, intermitentes) e insumos operacionais.' },
      { step: 4, title: 'Margem Operacional', description: 'Analise o resultado líquido e a margem percentual de cada contrato.' }
    ],
    fieldsAndStatus: [
      { term: 'Receita Operacional Líquida', explanation: 'Receita Bruta deduzida de impostos diretos (ISS, PIS, COFINS).', type: 'indicador' },
      { term: 'Margem de Contribuição', explanation: 'Receita Líquida menos custos operacionais diretos da equipe e insumos.', type: 'indicador' }
    ],
    checklist: [
      'Garantir que todos os custos extras e horas do mês foram apropriados antes de avaliar a DRE definitiva.'
    ],
    nextSteps: 'Utilize os insights para identificar contratos deficitários ou oportunidades de ganho de eficiência.',
    commonIssues: []
  },

  // ==========================================
  // 6. CADASTROS & SISTEMA
  // ==========================================
  {
    id: 'cadastros-central',
    routePattern: '/cadastros',
    title: 'Central de Cadastros',
    category: 'Cadastros & Sistema',
    targetRole: ['ADMIN', 'RH', 'FINANCEIRO'],
    purpose: 'Hub unificado para administração dos cadastros mestres do ERP (Colaboradores, Empresas, Fornecedores, Transportadoras, Serviços e Regras).',
    whenToUse: 'Sempre que precisar consultar ou alimentar as entidades fundamentais do sistema.',
    howItWorks: [
      { step: 1, title: 'Escolha da Entidade', description: 'Clique no card da entidade desejada (Colaboradores, Empresas, etc.).' },
      { step: 2, title: 'Gerenciamento', description: 'Inclua novos registros ou atualize os existentes com controle de histórico.' }
    ],
    fieldsAndStatus: [
      { term: 'Cadastros Mestres', explanation: 'Tabelas base que sustentam todos os formulários e transações operacionais.', type: 'campo' }
    ],
    checklist: ['Evitar duplicidades ao cadastrar novos registros utilizando busca prévia por CPF ou CNPJ.'],
    nextSteps: 'Os registros cadastrados ficam disponíveis imediatamente para seleção nas telas operacionais.',
    commonIssues: []
  },
  {
    id: 'cadastros-colaboradores',
    routePattern: '/colaboradores',
    title: 'Gestão de Colaboradores',
    category: 'Cadastros & Sistema',
    targetRole: ['ADMIN', 'RH'],
    purpose: 'Cadastrar e gerenciar todos os colaboradores da empresa (CLT, Intermitentes, Prestadores PJ e Autônomos).',
    whenToUse: 'Na admissão, alteração contratual, atualização de dados bancários ou desligamento.',
    howItWorks: [
      { step: 1, title: 'Inclusão do Colaborador', description: 'Informe Nome, CPF, Matrícula, Tipo de Contrato (CLT, Intermitente) e Cargo.' },
      { step: 2, title: 'Jornada e Horários', description: 'Vincule a escala de trabalho padrão e a carga horária semanal para controle de ponto.' },
      { step: 3, title: 'Dados Bancários', description: 'Cadastre a Chave PIX ou agência/conta para viabilizar pagamentos via CNAB.' },
      { step: 4, title: 'Ativação', description: 'Salve com status "Ativo" para habilitar a captura de pontos e escalação operacional.' }
    ],
    fieldsAndStatus: [
      { term: 'Tipo de Contrato', explanation: 'CLT (folha mensal e banco de horas) ou Intermitente (convocação sob demanda).', type: 'campo' },
      { term: 'Matrícula', explanation: 'Identificador único do colaborador utilizado na sincronização com os relógios REP.', type: 'campo' }
    ],
    checklist: [
      'CPF validado e sem duplicidade no sistema.',
      'Matrícula preenchida exatamente igual ao cadastro do relógio de ponto.',
      'Dados bancários conferidos para evitar falhas de remessa.'
    ],
    nextSteps: 'Colaborador integrado à rotina de pontos, escalas e folha de pagamento.',
    commonIssues: [
      { question: 'Ponto não sincroniza com o colaborador?', answer: 'Verifique se a matrícula cadastrada no ORBE é exatamente a mesma cadastrada no relógio REP/RHID.' }
    ]
  },
  {
    id: 'cadastros-empresas',
    routePattern: '/empresas',
    title: 'Cadastro de Empresas e Unidades',
    category: 'Cadastros & Sistema',
    targetRole: ['ADMIN', 'FINANCEIRO'],
    purpose: 'Cadastrar os clientes contratantes das operações logísticas e suas respectivas unidades/filiais de atendimento.',
    whenToUse: 'Na contratação de um novo cliente ou abertura de nova unidade física de atendimento.',
    howItWorks: [
      { step: 1, title: 'Dados da Empresa', description: 'Informe Razão Social, Nome Fantasia, CNPJ e Inscrição Estadual.' },
      { step: 2, title: 'Condições Comerciais', description: 'Configure a modalidade de faturamento (mensal, quinzenal), dia de corte e vencimento.' },
      { step: 3, title: 'Unidades Operacionais', description: 'Adicione os endereços físicos onde os encarregados farão os lançamentos.' },
      { step: 4, title: 'Salvar', description: 'Confirme o cadastro para disponibilizar a empresa nos formulários de campo.' }
    ],
    fieldsAndStatus: [
      { term: 'CNPJ', explanation: 'Identificador fiscal único do tomador do serviço.', type: 'campo' },
      { term: 'Unidade Operacional', explanation: 'Filial ou galpão logístico onde os serviços são executados.', type: 'campo' }
    ],
    checklist: [
      'CNPJ válido e dados de contato do setor financeiro do cliente preenchidos.'
    ],
    nextSteps: 'A empresa e suas unidades ficam disponíveis para o encarregado registrar operações por volume.',
    commonIssues: []
  },
  {
    id: 'cadastros-regras-operacionais',
    routePattern: '/cadastros/regras-operacionais',
    title: 'Regras e Tabelas Operacionais',
    category: 'Cadastros & Sistema',
    targetRole: ['ADMIN', 'FINANCEIRO'],
    purpose: 'Configurar tabelas de preços por volume, diárias padrão, alíquotas de ISS, taxas e valores de serviços específicos (CN5C, N1, etc.).',
    whenToUse: 'Ao reajustar tabelas contratuais ou definir novas regras de cálculo para clientes e fornecedores.',
    howItWorks: [
      { step: 1, title: 'Seleção do Tipo de Regra', description: 'Escolha se deseja parametrizar Preços de Volume, Serviços Específicos ou Taxas.' },
      { step: 2, title: 'Definição de Parâmetros', description: 'Informe o valor unitário, faixa horária ou regras de rateio de equipe.' },
      { step: 3, title: 'Vigência', description: 'Defina a data de início da vigência para aplicação automática nos novos lançamentos.' }
    ],
    fieldsAndStatus: [
      { term: 'Valor Unitário Padrão', explanation: 'Preço base por tonelada, caixa ou palete aplicado na ausência de tabela especial.', type: 'campo' },
      { term: 'Código Operacional', explanation: 'Sigla padronizada utilizada pelos encarregados em campo (ex: CN5C, MP, P).', type: 'campo' }
    ],
    checklist: [
      'Verificar se as regras especiais estão vinculadas à empresa correta.'
    ],
    nextSteps: 'As regras alimentam automaticamente o cálculo de valores nos formulários do Portal do Encarregado.',
    commonIssues: []
  },

  // ==========================================
  // 7. RELATÓRIOS & INTEGRAÇÕES
  // ==========================================
  {
    id: 'relatorios-central-oficial',
    routePattern: '/relatorios',
    title: 'Central Oficial de Relatórios',
    category: 'Relatórios & Integrações',
    targetRole: ['ADMIN', 'RH', 'FINANCEIRO'],
    purpose: 'Catálogo oficial de relatórios analíticos e sintéticos das áreas Operacional, RH, Financeira e Governança.',
    whenToUse: 'Sempre que precisar extrair relatórios para reuniões, auditorias, contabilidade ou clientes.',
    howItWorks: [
      { step: 1, title: 'Seleção da Categoria', description: 'Escolha a área desejada (Operações, RH, Financeiro, Fiscal).' },
      { step: 2, title: 'Escolha do Modelo', description: 'Clique no relatório desejado para abrir o visualizador interativo.' },
      { step: 3, title: 'Definição de Parâmetros', description: 'Filtre por período, empresa ou colaborador e visualize os dados em tela.' },
      { step: 4, title: 'Exportação', description: 'Exporte para PDF formatado ou planilha Excel/CSV conforme sua necessidade.' }
    ],
    fieldsAndStatus: [
      { term: 'Exportar PDF', explanation: 'Gera documento com layout formal para apresentação e impressão.', type: 'campo' },
      { term: 'Exportar Excel', explanation: 'Gera planilha em formato bruto para manipulação e conferência externa.', type: 'campo' }
    ],
    checklist: [
      'Certificar-se de selecionar a base correta (Produção) antes de exportar dados definitivos.'
    ],
    nextSteps: 'Arquivos gerados podem ser enviados para a diretoria, contabilidade ou clientes.',
    commonIssues: []
  },

  // ==========================================
  // 8. GOVERNANÇA & AUDITORIA
  // ==========================================
  {
    id: 'governanca-usuarios',
    routePattern: '/governanca/usuarios',
    title: 'Gestão de Usuários e Acessos',
    category: 'Governança & Auditoria',
    targetRole: ['ADMIN'],
    purpose: 'Gerenciar os usuários do sistema, convidar novos membros da equipe e definir perfis de acesso (Admin, RH, Financeiro, Encarregado).',
    whenToUse: 'Na contratação de novos profissionais ou alteração de funções e permissões.',
    howItWorks: [
      { step: 1, title: 'Convidar Usuário', description: 'Clique em "Novo Usuário", informe e-mail e selecione o perfil de acesso.' },
      { step: 2, title: 'Definição de Escopo', description: 'Defina se o usuário tem visão global ou se é restrito a certas unidades.' },
      { step: 3, title: 'Envio do Convite', description: 'O usuário recebe o link para criar sua senha segura.' }
    ],
    fieldsAndStatus: [
      { term: 'ADMIN', explanation: 'Acesso irrestrito a configurações, auditoria e cadastros do sistema.', type: 'status' },
      { term: 'RH', explanation: 'Acesso a pontos, banco de horas, diárias, intermitentes e aprovações RH.', type: 'status' },
      { term: 'FINANCEIRO', explanation: 'Acesso a faturamento, contas a pagar, remessas CNAB, DRE e receitas.', type: 'status' },
      { term: 'ENCARREGADO', explanation: 'Acesso restrito ao Portal Operacional de lançamentos de campo.', type: 'status' }
    ],
    checklist: [
      'Nunca conceder perfil ADMIN a usuários que necessitam apenas de acesso operacional ou RH.'
    ],
    nextSteps: 'O usuário recebe o convite e passa a acessar exclusivamente os módulos do seu perfil.',
    commonIssues: []
  },
  {
    id: 'governanca-auditoria',
    routePattern: '/governanca/auditoria',
    title: 'Trilha de Auditoria (Audit Logs)',
    category: 'Governança & Auditoria',
    targetRole: ['ADMIN'],
    purpose: 'Rastrear todas as ações críticas executadas no sistema: quem criou, editou, aprovou ou excluiu qualquer registro.',
    whenToUse: 'Em investigações de divergências, inspeções de conformidade e auditorias externas.',
    howItWorks: [
      { step: 1, title: 'Filtros de Trilha', description: 'Filtre por usuário, ação (INSERT, UPDATE, DELETE), tabela ou período.' },
      { step: 2, title: 'Snapshot Antes / Depois', description: 'Clique no evento para inspecionar os valores anteriores e os novos valores salvos.' }
    ],
    fieldsAndStatus: [
      { term: 'Imutabilidade', explanation: 'Os registros de log são gravados de forma permanente e não podem ser apagados.', type: 'regra' }
    ],
    checklist: ['Verificar se há ações críticas fora dos horários habituais de operação.'],
    nextSteps: 'Relatórios de auditoria podem ser exportados para conformidade com normas e governança corporativa.',
    commonIssues: []
  },

  // ==========================================
  // 9. PORTAL DO CLIENTE (EXTERNO)
  // ==========================================
  {
    id: 'cliente-dashboard',
    routePattern: '/cliente/dashboard',
    title: 'Portal do Cliente - Visão Geral',
    category: 'Ambiente Externo',
    targetRole: ['CLIENTE', 'ADMIN'],
    purpose: 'Permitir ao cliente contratante acompanhar em tempo real as operações logísticas executadas em suas instalações.',
    whenToUse: 'Para conferência de cargas atendidas no dia e acompanhamento do saldo de volumes contratados.',
    howItWorks: [
      { step: 1, title: 'Resumo Diário', description: 'Visualize caminhões atendidos e volume total movimentado no turno.' },
      { step: 2, title: 'Histórico Operacional', description: 'Consulte o histórico de descargas e serviços com placas e comprovantes.' }
    ],
    fieldsAndStatus: [
      { term: 'Volume Concluído', explanation: 'Total físico movimentado na unidade do cliente.', type: 'indicador' }
    ],
    checklist: ['Garantir que a empresa filtrada é exclusivamente a do cliente logado.'],
    nextSteps: 'O cliente pode consultar os relatórios completos na aba Relatórios do Cliente.',
    commonIssues: []
  }
];

/**
 * Localiza o guia de ajuda mais adequado para a rota e papel atual.
 */
export const getHelpGuideForPath = (pathname: string, userRole?: string): HelpGuideData | null => {
  // 1. Tenta match exato ou padrão de rota
  for (const guide of CONTEXTUAL_HELP_CATALOG) {
    if (matchPath({ path: guide.routePattern, end: true }, pathname)) {
      return adaptGuideForRole(guide, userRole);
    }
  }

  // 2. Tenta match por prefixo inteligente se não achou exato
  for (const guide of CONTEXTUAL_HELP_CATALOG) {
    if (pathname.startsWith(guide.routePattern) && guide.routePattern !== '/' && guide.routePattern !== '/operacional') {
      return adaptGuideForRole(guide, userRole);
    }
  }

  // 3. Fallbacks para aliases ou rotas conhecidas
  if (pathname.includes('/diaristas')) {
    const diaristasGuide = CONTEXTUAL_HELP_CATALOG.find(g => g.id === 'rh-diaristas-painel');
    if (diaristasGuide) return adaptGuideForRole(diaristasGuide, userRole);
  }

  if (pathname.includes('/intermitentes')) {
    const intermitentesGuide = CONTEXTUAL_HELP_CATALOG.find(g => g.id === 'rh-intermitentes-gestao');
    if (intermitentesGuide) return adaptGuideForRole(intermitentesGuide, userRole);
  }

  if (pathname.includes('/aprovacoes')) {
    const aprovacoesGuide = CONTEXTUAL_HELP_CATALOG.find(g => g.id === 'rh-aprovacoes-central');
    if (aprovacoesGuide) return adaptGuideForRole(aprovacoesGuide, userRole);
  }

  if (pathname.includes('/financeiro') || pathname.includes('/bancario')) {
    const finGuide = CONTEXTUAL_HELP_CATALOG.find(g => g.id === 'financeiro-receitas');
    if (finGuide) return adaptGuideForRole(finGuide, userRole);
  }

  // Fallback padrão se estiver no portal operacional
  if (pathname.startsWith('/producao')) {
    const prodGuide = CONTEXTUAL_HELP_CATALOG.find(g => g.id === 'producao-operacoes-volume');
    if (prodGuide) return adaptGuideForRole(prodGuide, userRole);
  }

  // Fallback geral: Dashboard Operacional
  const defaultGuide = CONTEXTUAL_HELP_CATALOG.find(g => g.id === 'operacional-dashboard');
  return defaultGuide ? adaptGuideForRole(defaultGuide, userRole) : null;
};

/**
 * Remove menções a áreas administrativas se o usuário for ENCARREGADO (isolamento de domínio).
 */
const adaptGuideForRole = (guide: HelpGuideData, userRole?: string): HelpGuideData => {
  if (userRole === 'ENCARREGADO') {
    return {
      ...guide,
      nextSteps: guide.nextSteps.replace(/financeiro|cnab|remessa|folha/gi, 'conferência da equipe interna'),
      commonIssues: guide.commonIssues.filter(i => !i.answer.toLowerCase().includes('financeiro') && !i.answer.toLowerCase().includes('cnab'))
    };
  }
  return guide;
};
