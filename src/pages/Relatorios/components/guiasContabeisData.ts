import { GuiaUsoData } from "./GuiaUsoDrawer";

/**
 * Conteúdos didáticos oficiais para as cinco telas contábeis do ERP ORBE.
 * Em conformidade estrita com CONT-06.
 */

export const GUIA_INTEGRACAO_CONTABIL: GuiaUsoData = {
  titulo: "Guia de Uso — Integração Contábil",
  subtitulo: "Conferência analítica, validação de partidas dobradas e exportação oficial de lotes",
  tagline: "Central Contábil • CONT-06",
  paraQueServe:
    "A tela de Integração Contábil é a ferramenta central de fechamento do ERP ORBE. Sua finalidade é compilar e auditar deterministicamente todas as receitas operacionais e despesas da competência, gerando os lançamentos de partidas dobradas (Débito = Crédito) para importação no sistema do contador externo.",
  comoUtilizar: [
    {
      passo: 1,
      titulo: "Selecione a Empresa e a Competência",
      desc: "Na barra de comandos superior, escolha a empresa e defina a competência contábil (formato AAAA-MM, ex: 2026-09) para carregar os dados correspondentes.",
    },
    {
      passo: 2,
      titulo: "Audite a Conferência e a Prévia Contábil",
      desc: "Na aba 'Conferência & Prévia Contábil', verifique os 4 cartões de KPIs: Total a Débito, Total a Crédito, Total de Lançamentos e a Diferença Contábil.",
    },
    {
      passo: 3,
      titulo: "Certifique-se de que a Diferença é R$ 0,00",
      desc: "Pelo princípio contábil fundamental das partidas dobradas, o total debitado deve ser exatamente igual ao creditado. Uma diferença diferente de zero indica desbalanceamento.",
    },
    {
      passo: 4,
      titulo: "Exporte o Lote Contábil Oficial",
      desc: "Se o fechamento financeiro estiver homologado ('FECHADO_FINANCEIRO') e não houver pendências de De-Para, clique no botão 'Exportar Lote Contábil Oficial'. O CSV oficial será gerado e baixado.",
    },
    {
      passo: 5,
      titulo: "Consulte o Registro Permanente de Auditoria",
      desc: "Acesse a aba 'Histórico & Logs' para consultar a data, usuário solicitante, hash SHA-256 e detalhes gravados no banco Supabase.",
    },
  ],
  oQueObservar: [
    {
      titulo: "Bloqueio por Fechamento Financeiro",
      desc: "Se a competência estiver 'EM_ABERTO' ou em 'PROCESSANDO', a exportação definitiva do lote permanecerá bloqueada para evitar o envio de dados incompletos ou em apuração.",
      tipo: "bloqueio",
    },
    {
      titulo: "Bloqueio por Mapeamento Pendente",
      desc: "Categorias operacionais com status 'Aguardando Plano de Contas' impedem a geração da prévia e do arquivo final até que as contas contábeis sejam configuradas.",
      tipo: "bloqueio",
    },
    {
      titulo: "Significado de Débito e Crédito",
      desc: "Débitos representam aplicações em custos/despesas ou entradas no ativo; Créditos representam receitas operacionais ou obrigações/passivos a liquidar.",
      tipo: "info",
    },
  ],
  exemploPratico: {
    cenario: "A competência 2026-09 da empresa Matriz foi homologada e fechada no módulo financeiro. O contador solicita o arquivo contábil mensal.",
    acao: "O analista acessa a tela, seleciona a Matriz e 2026-09, constata status 'Fechado no Financeiro', confere a diferença R$ 0,00 e clica em 'Exportar Lote Contábil Oficial'.",
    resultado: "O arquivo CSV estruturado é baixado imediatamente e um log com hash digital e identificador único é gravado na tabela contabil_logs_integracao.",
  },
  duvidasFrequentes: [
    {
      pergunta: "Por que o botão de exportação está desabilitado?",
      resposta: "O botão só é ativado se o período estiver com status FECHADO_FINANCEIRO no ERP, sem contas pendentes de mapeamento e sem diferença matemática entre débitos e créditos.",
    },
    {
      pergunta: "Posso consultar lotes de meses anteriores?",
      resposta: "Sim. Basta alterar a competência no cabeçalho ou navegar até a aba 'Histórico & Logs' para auditar qualquer período já registrado.",
    },
    {
      pergunta: "A exportação altera saldos de contas a pagar ou a receber?",
      resposta: "Não. A exportação contábil é uma leitura analítica gerencial que não altera valores de despesas, receitas, DRE, RH ou contas bancárias.",
    },
  ],
};

export const GUIA_MAPEAMENTO_CONTABIL: GuiaUsoData = {
  titulo: "Guia de Uso — Mapeamento Contábil (De-Para)",
  subtitulo: "Vinculação entre categorias operacionais do ORBE e as contas oficiais do plano contábil",
  tagline: "Plano de Contas • CONT-06",
  paraQueServe:
    "O Mapeamento Contábil define a amarração De-Para entre as operações realizadas pelo ERP ORBE (como receitas por volume, serviços específicos, custos extras e diaristas) e as contas analíticas de Débito e Crédito do plano de contas oficial da sua contabilidade.",
  comoUtilizar: [
    {
      passo: 1,
      titulo: "Selecione a Empresa",
      desc: "No cabeçalho, selecione a empresa cujas regras de mapeamento contábil você deseja auditar ou configurar.",
    },
    {
      passo: 2,
      titulo: "Localize a Categoria Operacional",
      desc: "Utilize a barra de busca rápida para filtrar categorias por título, tipo de operação ou código contábil.",
    },
    {
      passo: 3,
      titulo: "Abra a Janela de Edição",
      desc: "Clique no botão 'Editar' à direita da linha da categoria correspondente na tabela.",
    },
    {
      passo: 4,
      titulo: "Preencha as Contas Oficiais",
      desc: "Informe o Código e a Descrição da Conta Débito e da Conta Crédito rigorosamente conforme o plano de contas enviado pelo contador.",
    },
    {
      passo: 5,
      titulo: "Salve as Alterações",
      desc: "Clique em 'Salvar Mapeamento'. A regra é persistida com segurança no Supabase e a badge mudará de 'Pendente' para 'Mapeada'.",
    },
  ],
  oQueObservar: [
    {
      titulo: "Aguardando Plano de Contas",
      desc: "Categorias com essa indicação ainda não foram configuradas. Enquanto houver pendências, as exportações contábeis que utilizam essa categoria ficarão bloqueadas.",
      tipo: "bloqueio",
    },
    {
      titulo: "Proibição de Contas Fictícias",
      desc: "Nunca invente códigos contábeis nem utilize contas genéricas. Cada código deve corresponder a uma conta analítica real fornecida pelo escritório de contabilidade.",
      tipo: "alerta",
    },
    {
      titulo: "Diferença entre Conta Débito e Crédito",
      desc: "Para Receitas: Débito costuma ser Clientes a Receber / Banco e Crédito a Receita Operacional. Para Despesas: Débito é a Despesa/Custo e Crédito o Passivo/Fornecedor a pagar.",
      tipo: "info",
    },
  ],
  exemploPratico: {
    cenario: "A categoria 'Diaristas Operacionais' foi identificada como pendente de configuração para a filial.",
    acao: "O responsável clica em 'Editar', insere '3.1.2.01.004' (Despesas com Diárias) no Débito e '2.1.2.03.001' (Diaristas a Pagar) no Crédito e salva.",
    resultado: "A categoria passa a exibir o status 'Mapeada' (badge verde) e o contador de pendências cai para 0, liberando a emissão contábil.",
  },
  duvidasFrequentes: [
    {
      pergunta: "Posso alterar uma conta contábil que já foi utilizada?",
      resposta: "Sim. A alteração atualizará os próximos cálculos de prévia e exportações. Os registros de lotes passados mantêm o snapshot original para preservar a auditoria.",
    },
    {
      pergunta: "O que significa 'Natureza Operacional'?",
      resposta: "Indica se aquela categoria representa uma entrada de recursos (RECEITA) ou uma saída/compromisso de pagamento (DESPESA) no fluxo do ORBE.",
    },
  ],
};

export const GUIA_LOGS_INTEGRACAO: GuiaUsoData = {
  titulo: "Guia de Uso — Logs de Integração Contábil",
  subtitulo: "Auditoria determinística, rastreabilidade e histórico de lotes contábeis gravados",
  tagline: "Auditoria & Governança • CONT-06",
  paraQueServe:
    "A tela de Logs de Integração Contábil registra detalhadamente cada exportação, arquivo gerado e execução contábil. Ela garante a rastreabilidade imutável de quem executou, quando, quais valores foram movimentados e a integridade do conteúdo através de assinaturas criptográficas.",
  comoUtilizar: [
    {
      passo: 1,
      titulo: "Filtre os Registros Desejados",
      desc: "Utilize os seletores para filtrar por Empresa, Competência (AAAA-MM), Status (Sucesso ou Falha) ou período de datas.",
    },
    {
      passo: 2,
      titulo: "Pesquise por Texto",
      desc: "Digite no campo de busca para encontrar eventos por nome de arquivo, nome do solicitante ou assinatura digital (Hash).",
    },
    {
      passo: 3,
      titulo: "Analise os Cards de Métricas",
      desc: "Acompanhe no topo o total de registros, total de lançamentos em partidas dobradas, volume em R$ movimentado e número de falhas.",
    },
    {
      passo: 4,
      titulo: "Examine os Detalhes do Lote",
      desc: "Clique no botão 'Detalhes' na linha de qualquer log para inspecionar o modal completo com ID de rastreabilidade, assinatura SHA e payload.",
    },
  ],
  oQueObservar: [
    {
      titulo: "Eventos com Falha",
      desc: "Registros com badge vermelha indicam que a exportação foi interrompida ou encontrou inconsistência técnica. O motivo exato é exibido no campo 'Detalhes do Erro'.",
      tipo: "alerta",
    },
    {
      titulo: "Assinatura de Conteúdo (Hash)",
      desc: "O hash garante que o arquivo CSV emitido não sofreu modificação após ter sido registrado pelo sistema.",
      tipo: "info",
    },
    {
      titulo: "Imutabilidade dos Logs",
      desc: "Os registros não podem ser editados nem apagados por nenhum usuário, garantindo a conformidade com as regras de compliance e auditoria externa.",
      tipo: "bloqueio",
    },
  ],
  exemploPratico: {
    cenario: "Uma auditoria contábil solicita evidências de quem gerou o arquivo de fechamento de agosto/2026 e qual foi o total movimentado.",
    acao: "O gestor acessa os logs, filtra por '2026-08' e clica em 'Detalhes' do registro emitido.",
    resultado: "É visualizada a data/hora exata, o e-mail do usuário solicitante, o valor consolidado e o hash único do arquivo.",
  },
  duvidasFrequentes: [
    {
      pergunta: "Por que os logs não podem ser excluídos?",
      resposta: "A imutabilidade é uma exigência de governança e compliance contábil para garantir que nenhuma exportação financeira possa ser omitida ou ocultada.",
    },
    {
      pergunta: "Quantos registros são exibidos por página?",
      resposta: "A tabela exibe 10 registros por página com paginação determinística e botões de navegação 'Anterior' e 'Próximo'.",
    },
  ],
};

export const GUIA_AGENDAMENTOS_CONTABEIS: GuiaUsoData = {
  titulo: "Guia de Uso — Agendamentos Contábeis",
  subtitulo: "Programação e governança de rotinas periódicas de fechamento contábil",
  tagline: "Rotinas Automáticas • CONT-06",
  paraQueServe:
    "A tela de Agendamentos Contábeis permite cadastrar e organizar rotinas automáticas de fechamento e preparação de relatórios contábeis mensais por empresa, definindo dias do mês, horários e destinatários responsáveis.",
  comoUtilizar: [
    {
      passo: 1,
      titulo: "Selecione a Empresa",
      desc: "Escolha uma empresa no cabeçalho ou selecione 'Todas as Empresas' para visualizar a lista geral.",
    },
    {
      passo: 2,
      titulo: "Clique em 'Novo Agendamento'",
      desc: "Abra o modal de criação informando a identificação da rotina (ex: 'Fechamento Contábil Mensal Matriz').",
    },
    {
      passo: 3,
      titulo: "Defina o Dia e Horário",
      desc: "Escolha o dia limite de execução no mês (ex: todo dia 05) e o horário desejado (ex: 18:00).",
    },
    {
      passo: 4,
      titulo: "Salve a Configuração",
      desc: "Clique em 'Criar Agendamento'. A rotina será gravada no banco com o status 'Aguardando ativação'.",
    },
    {
      passo: 5,
      titulo: "Monitore a Previsão",
      desc: "Consulte na tabela a coluna 'Próxima Execução Prevista' para acompanhar o cronograma do calendário contábil.",
    },
  ],
  oQueObservar: [
    {
      titulo: "Status 'Aguardando Ativação' (Governança)",
      desc: "Por diretriz de segurança, os agendamentos cadastrados permanecem salvos com status 'Aguardando ativação'. O disparo automático só ocorrerá quando o motor executor em segundo plano for ativado e homologado.",
      tipo: "bloqueio",
    },
    {
      titulo: "Pré-requisitos Mandatórios para Exportação",
      desc: "Mesmo com o processamento automático ativo, nenhuma exportação definitiva ocorrerá sem que a competência esteja fechada no financeiro e com mapeamento 100% completo.",
      tipo: "alerta",
    },
    {
      titulo: "Proibição de Jobs Fictícios",
      desc: "O ORBE não simula agendamentos executando em segundo plano. Todas as rotinas cadastradas refletem dados reais persistidos na base.",
      tipo: "info",
    },
  ],
  exemploPratico: {
    cenario: "A controladoria define que toda rotina de fechamento contábil deve estar programada para o 5º dia útil de cada mês.",
    acao: "O usuário cria um agendamento selecionando a Matriz, frequência mensal, dia 07 e horário 19:00.",
    resultado: "A rotina é gravada com segurança, com cálculo de próxima execução prevista, pronta para disparo assim que o executor background for ativado.",
  },
  duvidasFrequentes: [
    {
      pergunta: "Por que as rotinas ficam com status 'Aguardando ativação'?",
      resposta: "Esta é uma trava de governança do ERP ORBE para garantir que agendamentos não disparem exportações sem que o executor em segundo plano e os controles de permissões estejam oficialmente homologados.",
    },
    {
      pergunta: "Posso cancelar uma rotina já cadastrada?",
      resposta: "Sim. Na tabela de agendamentos é possível alterar o status ou remover rotinas que não serão mais utilizadas.",
    },
  ],
};

export const GUIA_LAYOUTS_EXPORTACAO: GuiaUsoData = {
  titulo: "Guia de Uso — Layouts de Exportação",
  subtitulo: "Parametrização técnica de formato, delimitadores e colunas do arquivo CSV contábil",
  tagline: "Leiautes & CSV • CONT-06",
  paraQueServe:
    "A tela de Layouts de Exportação permite configurar os parâmetros técnicos dos arquivos CSV gerados pelo ORBE, tais como delimitador de colunas, codificação de caracteres, formato de datas, separador monetário e seleção/ordenação dos campos, adequando o arquivo aos requisitos da contabilidade.",
  comoUtilizar: [
    {
      passo: 1,
      titulo: "Selecione a Empresa",
      desc: "Escolha a empresa para a qual deseja configurar o leiaute. Cada empresa pode ter sua própria parametrização salva.",
    },
    {
      passo: 2,
      titulo: "Configure os Parâmetros Técnicos",
      desc: "Defina o Delimitador (Ponto e vírgula, vírgula ou tabulação), a Codificação (UTF-8 ou ISO-8859-1), o formato de Data e o formato Numérico.",
    },
    {
      passo: 3,
      titulo: "Selecione e Ordene as Colunas",
      desc: "Marque as colunas que devem constar no arquivo e utilize as setas para cima/baixo para alterar a ordem das colunas.",
    },
    {
      passo: 4,
      titulo: "Confira a Pré-visualização Instantânea",
      desc: "O painel inferior de 'Prévia do Arquivo CSV' atualiza dinamicamente conforme você altera qualquer parâmetro ou ordem.",
    },
    {
      passo: 5,
      titulo: "Baixe o Arquivo-Modelo e Salve",
      desc: "Clique em 'Download de Modelo' para testar a importação no software do contador e clique em 'Salvar Configurações' para persistir.",
    },
  ],
  oQueObservar: [
    {
      titulo: "Compatibilidade com Softwares Contábeis",
      desc: "Ajustar delimitadores e colunas ajuda na importação, mas formatos personalizados não garantem compatibilidade automática com sistemas como Domínio, Questor ou TOTVS, que exigem layouts homologados.",
      tipo: "alerta",
    },
    {
      titulo: "Arquivo-Modelo sem Dados Confidenciais",
      desc: "O download de arquivo-modelo gera linhas com dados conceituais limpos, sem expor dados financeiros reais da sua empresa.",
      tipo: "info",
    },
    {
      titulo: "Restaurar Padrão ORBE",
      desc: "Caso haja qualquer dúvida ou problema com o formato personalizado, clique no botão 'Restaurar Padrão ORBE' para retornar aos parâmetros canônicos homologados.",
      tipo: "info",
    },
  ],
  exemploPratico: {
    cenario: "O sistema do contador necessita que o arquivo utilize delimitador de vírgula (,) e formato de data AAAA-MM-DD para importação automática.",
    acao: "O analista acessa a tela, seleciona a empresa, muda o delimitador para 'Vírgula (,)' e o formato de data para 'AAAA-MM-DD' e clica em 'Salvar Configurações'.",
    resultado: "As configurações são gravadas no Supabase e todas as futuras exportações daquela empresa passarão a respeitar essas regras.",
  },
  duvidasFrequentes: [
    {
      pergunta: "O que acontece se eu clicar em 'Restaurar Padrão ORBE'?",
      resposta: "Os parâmetros voltam para o padrão oficial: Delimitador ';' (ponto e vírgula), Codificação UTF-8, Data 'DD/MM/AAAA', valor '1.234,56' e as 6 colunas canônicas ativadas.",
    },
    {
      pergunta: "As alterações de uma empresa afetam as outras?",
      resposta: "Não. As configurações de leiaute são salvas de maneira isolada por empresa no Supabase.",
    },
  ],
};

