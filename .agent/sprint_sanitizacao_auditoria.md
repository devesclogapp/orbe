# Sprint: Auditoria de Segregação (Supabase)

| Arquivo | Local | Tabela | Tem filtro empresa_id? | Usa safeTestIds (Protegido)? | Necessita Correção? |
| --- | --- | --- | --- | --- | --- |
| `src\checkDuplicates.ts` | Linha 10 | `financeiro_consolidados_cliente` | Sim | Não | SIM |
| `src\checkDuplicates.ts` | Linha 24 | `financeiro_consolidados_colaborador` | Sim | Não | SIM |
| `src\checkDuplicates.ts` | Linha 37 | `faturas` | Sim | Não | SIM |
| `src\components\ponto\ImportacoesTimeline.tsx` | Linha 90 | `registros_ponto` | Não | Não | SIM |
| `src\components\ponto\ImportacoesTimeline.tsx` | Linha 109 | `registros_ponto` | Não | Não | SIM |
| `src\contexts\AccessControlContext.tsx` | Linha 51 | `user_permissions` | Não | Não | SIM |
| `src\contexts\ClientContext.tsx` | Linha 42 | `clientes` | Sim | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 234 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\contexts\OnboardingContext.tsx` | Linha 235 | `transportadoras_clientes` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 236 | `fornecedores` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 238 | `colaboradores` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 239 | `fornecedor_valores_servico` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 240 | `operacoes_producao` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 241 | `regras_marcacao_diaristas` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 242 | `regras_dados` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 243 | `produtos_carga` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 244 | `servicos_especificos_regras` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 245 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\contexts\OnboardingContext.tsx` | Linha 375 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\contexts\OnboardingContext.tsx` | Linha 409 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\contexts\OnboardingContext.tsx` | Linha 536 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\contexts\OnboardingContext.tsx` | Linha 560 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\contexts\TenantContext.tsx` | Linha 46 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\contexts\TenantContext.tsx` | Linha 67 | `tenants` | Não | Não | SIM |
| `src\hooks\useTenantFilter.ts` | Linha 33 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\hooks\useTenantFilter.ts` | Linha 47 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\lib\tenant.utils.ts` | Linha 8 | `profiles` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\lib\tenant.utils.ts` | Linha 24 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Auth\Cadastro.tsx` | Linha 249 | `tenants` | Não | Não | SIM |
| `src\pages\Auth\Cadastro.tsx` | Linha 262 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Auth\Login.tsx` | Linha 46 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Auth\LoginOperacional.tsx` | Linha 45 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\BancoHoras\ProcessamentoRH.tsx` | Linha 406 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\BancoHoras\ProcessamentoRH.tsx` | Linha 430 | `registros_ponto` | Não | Sim | Não |
| `src\pages\BancoHoras\ProcessamentoRH.tsx` | Linha 474 | `registros_ponto` | Não | Sim | Não |
| `src\pages\BancoHoras\ProcessamentoRH.tsx` | Linha 504 | `banco_horas_saldos` | Não | Não | SIM |
| `src\pages\BancoHoras\ProcessamentoRH.tsx` | Linha 519 | `processamento_rh_logs` | Sim | Não | SIM |
| `src\pages\BancoHoras\ProcessamentoRH.tsx` | Linha 545 | `processamento_rh_inconsistencias` | Sim | Não | SIM |
| `src\pages\BancoHoras\ProcessamentoRH.tsx` | Linha 1285 | `processamento_rh_inconsistencias` | Não | Não | SIM |
| `src\pages\CentralBancaria.tsx` | Linha 137 | `financeiro_competencias` | Não | Não | SIM |
| `src\pages\CentralCadastros.tsx` | Linha 582 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\pages\CentralCadastros.tsx` | Linha 593 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\pages\CentralCadastros.tsx` | Linha 5454 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\pages\CentralCadastros.tsx` | Linha 5461 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\pages\CentralOperacional.tsx` | Linha 79 | `operacoes` | Não | Não | SIM |
| `src\pages\CentralOperacional.tsx` | Linha 92 | `registros_ponto` | Não | Não | SIM |
| `src\pages\CentralOperacional.tsx` | Linha 105 | `diaristas_lancamentos` | Não | Não | SIM |
| `src\pages\CentralOperacional.tsx` | Linha 118 | `fechamentos` | Não | Não | SIM |
| `src\pages\CentralOperacional.tsx` | Linha 131 | `banco_horas_saldo` | Não | Não | SIM |
| `src\pages\Coletores.tsx` | Linha 111 | `unidades` | Sim | Não | SIM |
| `src\pages\Coletores.tsx` | Linha 112 | `unidades_operacionais` | Sim | Não | SIM |
| `src\pages\Configuracoes.tsx` | Linha 266 | `profiles` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\pages\DiagnosticoTenant.tsx` | Linha 68 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\DiagnosticoTenant.tsx` | Linha 79 | `tenants` | Não | Não | SIM |
| `src\pages\DiagnosticoTenant.tsx` | Linha 89 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\DiagnosticoTenant.tsx` | Linha 108 | `operacoes_producao` | Não | Não | SIM |
| `src\pages\DiagnosticoTenant.tsx` | Linha 133 | `servicos_extras_operacionais` | Não | Não | SIM |
| `src\pages\DiagnosticoTenant.tsx` | Linha 150 | `custos_extras_operacionais` | Não | Não | SIM |
| `src\pages\Fechamento.tsx` | Linha 71 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Fechamento.tsx` | Linha 80 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Fechamento.tsx` | Linha 181 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\pages\Fechamento.tsx` | Linha 196 | `servicos_extras_operacionais` | Sim | Não | SIM |
| `src\pages\Financeiro\CentralBancariaDiaristas.tsx` | Linha 155 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Financeiro\CentralBancariaDiaristas.tsx` | Linha 222 | `lancamentos_diaristas` | Sim | Não | SIM |
| `src\pages\Financeiro\components\ConciliacaoReceitasBlock.tsx` | Linha 49 | `receitas_operacionais` | Não | Não | SIM |
| `src\pages\Financeiro\DetalhamentoColaborador.tsx` | Linha 21 | `colaboradores` | Sim | Não | SIM |
| `src\pages\Financeiro\FaturamentoCliente.tsx` | Linha 90 | `operacoes_producao` | Sim | Não | SIM |
| `src\pages\Financeiro\RemessaCNAB.tsx` | Linha 45 | `financeiro_competencias` | Não | Não | SIM |
| `src\pages\Governanca\Usuarios.tsx` | Linha 319 | `tenant_invitations` | Não | Não | SIM |
| `src\pages\Operacional\IntermitentesRecebidos.tsx` | Linha 141 | `lancamentos_intermitentes` | Sim | Não | SIM |
| `src\pages\Producao\DiaristasLancamento.tsx` | Linha 151 | `profiles` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Producao\DiaristasLancamento.tsx` | Linha 179 | `locais_operacionais` | Não | Não | SIM |
| `src\pages\RegrasOperacionais.tsx` | Linha 813 | `profiles` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Rh\AprovacoesRh.tsx` | Linha 241 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\pages\Rh\AprovacoesRh.tsx` | Linha 252 | `registros_ponto` | Não | Não | SIM |
| `src\pages\Rh\AprovacoesRh.tsx` | Linha 276 | `operacoes_producao` | Não | Não | SIM |
| `src\pages\Rh\AprovacoesRh.tsx` | Linha 294 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\pages\Rh\AprovacoesRh.tsx` | Linha 304 | `registros_ponto` | Não | Não | SIM |
| `src\pages\Rh\AprovacoesRh.tsx` | Linha 326 | `operacoes_producao` | Não | Não | SIM |
| `src\pages\Rh\RhDiaristasGestao.tsx` | Linha 78 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 132 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 150 | `unidades_operacionais` | Não | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 291 | `diaristas_logs_fechamento` | Sim | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 403 | `lancamentos_diaristas` | Sim | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 425 | `diaristas_lotes_fechamento` | Sim | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 435 | `diaristas_lotes_fechamento` | Sim | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 469 | `diaristas_logs_fechamento` | Sim | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 503 | `lancamentos_diaristas` | Sim | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 515 | `diaristas_lotes_fechamento` | Não | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 878 | `diaristas_lotes_fechamento` | Sim | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 885 | `lancamentos_diaristas` | Sim | Não | SIM |
| `src\pages\Rh\RhDiaristasPainel.tsx` | Linha 890 | `diaristas_logs_fechamento` | Sim | Não | SIM |
| `src\services\accounting.service.ts` | Linha 11 | `contabil_mapeamento` | Sim | Não | SIM |
| `src\services\accounting.service.ts` | Linha 20 | `contabil_logs_integracao` | Não | Não | SIM |
| `src\services\accounting.service.ts` | Linha 30 | `contabil_logs_integracao` | Não | Não | SIM |
| `src\services\automation\AutomationWorker.ts` | Linha 74 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\AutomationWorker.ts` | Linha 91 | `automacao_execucoes` | Não | Não | SIM |
| `src\services\automation\AutomationWorker.ts` | Linha 106 | `automacao_execucoes` | Não | Não | SIM |
| `src\services\automation\AutomationWorker.ts` | Linha 130 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\AutomationWorker.ts` | Linha 139 | `automacao_execucoes` | Não | Não | SIM |
| `src\services\automation\AutomationWorker.ts` | Linha 152 | `automacao_execucoes` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 150 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 164 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 194 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 219 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 237 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 245 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 254 | `automacao_execucoes` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 288 | `colaboradores` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 321 | `registros_ponto` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 377 | `automacao_alertas` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 390 | `automacao_alertas` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 405 | `ciclos_operacionais` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 413 | `automacao_alertas` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 423 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 429 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 445 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 497 | `automacao_alertas` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 579 | `colaboradores` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 599 | `registros_ponto` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 621 | `registros_ponto` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 641 | `registros_ponto` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 664 | `contas_bancarias_empresa` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 687 | `colaboradores` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 693 | `registros_ponto` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 705 | `lote_pagamento_itens` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 723 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 731 | `lotes_remessa` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 745 | `operacoes_producao` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 762 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 807 | `automacao_alertas` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 825 | `automacao_alertas` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 846 | `automacao_alertas` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 859 | `automacao_alertas` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 869 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 876 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 910 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 917 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 929 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 936 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 948 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 955 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 964 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 972 | `automacao_execucoes` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 999 | `automacao_alertas` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 1014 | `automacao_alertas` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 1024 | `automacao_alertas` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 1044 | `automacao_alertas` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 1064 | `automacao_execucoes` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 1081 | `automacao_alertas` | Sim | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 1122 | `auditoria` | Não | Não | SIM |
| `src\services\automation\OperationalAutomationEngine.ts` | Linha 1138 | `auditoria_workflow_ciclos` | Não | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 89 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\bankAccount.service.ts` | Linha 125 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 136 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 153 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 164 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 196 | `contas_bancarias_empresa` | Não | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 246 | `contas_bancarias_empresa` | Não | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 282 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 288 | `contas_bancarias_empresa` | Não | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 300 | `contas_bancarias_empresa` | Não | Não | SIM |
| `src\services\bankAccount.service.ts` | Linha 320 | `contas_bancarias_empresa` | Não | Não | SIM |
| `src\services\cnab\CNABBase.ts` | Linha 9 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\cnab\CNABBase.ts` | Linha 34 | `rh_financeiro_lote_itens` | Não | Não | SIM |
| `src\services\cnab\CNABBase.ts` | Linha 53 | `faturas` | Não | Não | SIM |
| `src\services\cnab\CNABBase.ts` | Linha 71 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\cnab\CNABBase.ts` | Linha 74 | `lotes_remessa` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 12 | `cnab_retorno_itens` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 46 | `faturas` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 54 | `faturas` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 59 | `lotes_remessa` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 71 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 80 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 84 | `diaristas_lotes_fechamento` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 96 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 110 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 114 | `intermitentes_lotes_fechamento` | Não | Não | SIM |
| `src\services\cnab\cnabConciliacao.service.ts` | Linha 128 | `cnab_retorno_itens` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 108 | `lotes_remessa` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 136 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 165 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 179 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 191 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 267 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 318 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 342 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 372 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 402 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 436 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 440 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 445 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 467 | `cnab_remessas_arquivos` | Não | Sim | Não |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 481 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 485 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 490 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 536 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 543 | `cnab_auditoria_bancaria` | Não | Não | SIM |
| `src\services\cnab\cnabRemessaArquivo.service.ts` | Linha 559 | `cnab_auditoria_bancaria` | Não | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 157 | `cnab_retorno_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 168 | `cnab_retorno_itens` | Não | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 187 | `cnab_retorno_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 270 | `cnab_retorno_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 295 | `cnab_retorno_itens` | Não | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 391 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 446 | `faturas` | Sim | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 456 | `diaristas_lotes_fechamento` | Sim | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 466 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 483 | `faturas` | Sim | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 498 | `intermitentes_lotes_fechamento` | Sim | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 508 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\cnab\cnabRetorno.service.ts` | Linha 548 | `faturas` | Não | Não | SIM |
| `src\services\dashboard.service.ts` | Linha 256 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\dashboard.service.ts` | Linha 260 | `contas_bancarias_empresa` | Sim | Sim | Não |
| `src\services\dashboard.service.ts` | Linha 286 | `receitas_operacionais` | Sim | Não | SIM |
| `src\services\dashboard.service.ts` | Linha 297 | `diaristas_lotes_fechamento` | Sim | Não | SIM |
| `src\services\dashboard.service.ts` | Linha 304 | `rh_financeiro_lotes` | Sim | Não | SIM |
| `src\services\dashboard.service.ts` | Linha 315 | `lotes_remessa` | Sim | Não | SIM |
| `src\services\dashboard.service.ts` | Linha 326 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\dashboard.service.ts` | Linha 334 | `cnab_retorno_itens` | Não | Não | SIM |
| `src\services\dashboard.service.ts` | Linha 345 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\services\dashboard.service.ts` | Linha 353 | `servicos_extras_operacionais` | Sim | Não | SIM |
| `src\services\domain\aprovacoes.service.ts` | Linha 32 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\aprovacoes.service.ts` | Linha 43 | `vw_aprovacoes_rh` | Sim | Não | SIM |
| `src\services\domain\aprovacoes.service.ts` | Linha 100 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\aprovacoes.service.ts` | Linha 114 | `vw_aprovacoes_rh` | Sim | Não | SIM |
| `src\services\domain\base.service.ts` | Linha 68 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\base.service.ts` | Linha 102 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\base.service.ts` | Linha 118 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 52 | `empresas` | Não | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 70 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 83 | `colaboradores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 84 | `coletores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 112 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 129 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 150 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 163 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 180 | `colaboradores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 191 | `coletores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 202 | `operacoes` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 213 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 243 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 265 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 285 | `colaboradores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 306 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 337 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 349 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 365 | `colaboradores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 377 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 405 | `colaboradores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 420 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 455 | `colaboradores` | Sim | Sim | Não |
| `src\services\domain\cadastros.service.ts` | Linha 466 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 495 | `colaboradores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 565 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 578 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 595 | `colaboradores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 628 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 661 | `coletores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 666 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\cadastros.service.ts` | Linha 667 | `unidades_operacionais` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 722 | `coletores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 731 | `coletores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 769 | `coletores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 780 | `coletores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 814 | `unidades` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 828 | `transportadoras_clientes` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 845 | `transportadoras_clientes` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 864 | `transportadoras_clientes` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 881 | `transportadoras_clientes` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 900 | `transportadoras_clientes` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 913 | `transportadoras_clientes` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 925 | `transportadoras_clientes` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 949 | `transportadoras_clientes` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 962 | `fornecedores` | Sim | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 982 | `fornecedores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1006 | `fornecedores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1017 | `produtos_carga` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1032 | `fornecedores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1055 | `fornecedores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1066 | `produtos_carga` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1068 | `produtos_carga` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1077 | `fornecedores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1086 | `fornecedores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1098 | `fornecedores` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1135 | `materiais_operacionais` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1144 | `materiais_operacionais` | Não | Não | SIM |
| `src\services\domain\cadastros.service.ts` | Linha 1167 | `materiais_operacionais` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 229 | `perfis_usuarios` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 236 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\core.service.ts` | Linha 245 | `logs_sincronizacao` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 247 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\core.service.ts` | Linha 258 | `resultados_processamento` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 260 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\core.service.ts` | Linha 272 | `resultados_processamento` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 330 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\core.service.ts` | Linha 359 | `operacoes` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 461 | `operacoes` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 481 | `operacoes` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 491 | `operacoes` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 504 | `resultados_processamento` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 586 | `financeiro_regras` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 596 | `financeiro_regras` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 632 | `historico_importacoes` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 676 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\core.service.ts` | Linha 679 | `coletores` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 682 | `unidades_operacionais` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 733 | `regras_financeiras` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 743 | `regras_financeiras` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 780 | `financeiro_competencias` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 800 | `equipes` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 814 | `config_tipos_operacao` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 831 | `config_tipos_operacao` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 850 | `config_tipos_operacao` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 917 | `unidades_operacionais` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 922 | `unidades` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 948 | `tipos_servico_operacional` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 962 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 973 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 986 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 997 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1008 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1018 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1028 | `operacoes_producao` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1032 | `fornecedor_valores_servico` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1049 | `tipos_servico_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1079 | `produtos_carga` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1090 | `produtos_carga` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1107 | `produtos_carga` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1122 | `produtos_carga` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1133 | `produtos_carga` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1149 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1164 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1175 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1193 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1223 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1233 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1252 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1263 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1282 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1292 | `formas_pagamento_operacional` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1493 | `colaboradores` | Sim | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1540 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1573 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1691 | `regras_campos` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1708 | `regras_campos` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1715 | `regras_dados` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1729 | `regras_dados` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1758 | `regras_dados` | Não | Não | SIM |
| `src\services\domain\core.service.ts` | Linha 1764 | `regras_campos` | Não | Não | SIM |
| `src\services\domain\despesas.service.ts` | Linha 20 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\services\domain\despesas.service.ts` | Linha 41 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\despesas.service.ts` | Linha 47 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\services\domain\despesas.service.ts` | Linha 62 | `custos_extras_operacionais` | Não | Não | SIM |
| `src\services\domain\despesas.service.ts` | Linha 92 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\services\domain\despesas.service.ts` | Linha 110 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\despesas.service.ts` | Linha 134 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\services\domain\despesas.service.ts` | Linha 156 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\services\domain\despesas.service.ts` | Linha 191 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\despesas.service.ts` | Linha 208 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\services\domain\despesas.service.ts` | Linha 239 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 66 | `lancamentos_diaristas` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 104 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\diaristas.service.ts` | Linha 119 | `lancamentos_diaristas` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 130 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 178 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 194 | `lancamentos_diaristas` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 250 | `lancamentos_diaristas` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 260 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 274 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 285 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 301 | `diaristas_lotes_fechamento` | Sim | Sim | Não |
| `src\services\domain\diaristas.service.ts` | Linha 313 | `empresas` | Não | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\diaristas.service.ts` | Linha 322 | `diaristas_lotes_fechamento` | Sim | Sim | Não |
| `src\services\domain\diaristas.service.ts` | Linha 346 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 363 | `profiles` | Não | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\diaristas.service.ts` | Linha 380 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\diaristas.service.ts` | Linha 386 | `diaristas_lotes_fechamento` | Sim | Sim | Não |
| `src\services\domain\diaristas.service.ts` | Linha 405 | `diaristas_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 413 | `lancamentos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 425 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\diaristas.service.ts` | Linha 468 | `lancamentos_diaristas` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 509 | `diaristas_lotes_fechamento` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 521 | `diaristas_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 542 | `diaristas_lotes_fechamento` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 690 | `diaristas_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 820 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 840 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 879 | `diaristas_lotes_fechamento` | Sim | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 918 | `regras_fechamento` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 929 | `regras_fechamento` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 940 | `ciclos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 952 | `ciclos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 962 | `ciclos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 973 | `ciclos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1005 | `ciclos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1021 | `ciclos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1037 | `lote_pagamento_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1046 | `lote_pagamento_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1058 | `lote_pagamento_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1077 | `lote_pagamento_itens` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1082 | `ciclos_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1091 | `lote_pagamento_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1106 | `lancamentos_adicionais_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1123 | `lancamentos_adicionais_diaristas` | Não | Não | SIM |
| `src\services\domain\diaristas.service.ts` | Linha 1147 | `ciclos_diaristas` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 68 | `lancamentos_intermitentes` | Sim | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 115 | `intermitentes_lotes_fechamento` | Sim | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 136 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 155 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\intermitentes.service.ts` | Linha 161 | `intermitentes_lotes_fechamento` | Sim | Sim | Não |
| `src\services\domain\intermitentes.service.ts` | Linha 181 | `intermitentes_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 189 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 252 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\intermitentes.service.ts` | Linha 260 | `intermitentes_lotes_fechamento` | Sim | Sim | Não |
| `src\services\domain\intermitentes.service.ts` | Linha 279 | `intermitentes_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 286 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 299 | `rh_financeiro_lotes` | Sim | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 315 | `rh_financeiro_lotes` | Sim | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 335 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 347 | `rh_financeiro_lote_itens` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 368 | `rh_financeiro_lote_itens` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 374 | `rh_financeiro_lote_itens` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 382 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 392 | `intermitentes_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 403 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 420 | `intermitentes_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 431 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 443 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 466 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 495 | `intermitentes_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 501 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 513 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 520 | `intermitentes_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 552 | `intermitentes_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 563 | `lancamentos_intermitentes` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 597 | `colaboradores` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 667 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 687 | `cnab_remessas_arquivos` | Não | Não | SIM |
| `src\services\domain\intermitentes.service.ts` | Linha 725 | `intermitentes_lotes_fechamento` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 42 | `registros_ponto` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 62 | `registros_ponto` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 78 | `registros_ponto` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 107 | `registros_ponto` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 124 | `registros_ponto` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 148 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 154 | `processamento_rh_inconsistencias` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 160 | `processamento_rh_logs` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 174 | `fechamento_mensal` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 192 | `registros_ponto` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 207 | `banco_horas_eventos` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 266 | `banco_horas_saldos` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 275 | `banco_horas_saldos` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 297 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\domain\producao.service.ts` | Linha 302 | `financeiro_consolidados_cliente` | Sim | Sim | Não |
| `src\services\domain\producao.service.ts` | Linha 317 | `financeiro_consolidados_colaborador` | Sim | Sim | Não |
| `src\services\domain\producao.service.ts` | Linha 339 | `financeiro_consolidados_cliente` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 349 | `financeiro_consolidados_cliente` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 362 | `configuracoes_operacionais` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 383 | `configuracoes_operacionais` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 392 | `configuracoes_operacionais` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 402 | `configuracoes_operacionais` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 415 | `fornecedor_valores_servico` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 484 | `fornecedor_valores_servico` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 547 | `fornecedor_valores_servico` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 601 | `fornecedor_valores_servico` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 624 | `fornecedor_valores_servico` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 644 | `fornecedor_valores_servico` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 776 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\producao.service.ts` | Linha 782 | `operacoes_producao` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 791 | `operacoes_producao` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 823 | `operacoes_producao` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 892 | `production_entry_collaborators` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 914 | `operacao_producao_materiais` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 948 | `operacao_producao_materiais` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 994 | `production_entry_collaborators` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1023 | `production_entry_collaborators` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1045 | `operacao_producao_materiais` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1051 | `operacao_producao_materiais` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1095 | `operacoes_producao` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1135 | `operacoes_producao` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1169 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\producao.service.ts` | Linha 1188 | `operacoes_producao` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1242 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\producao.service.ts` | Linha 1277 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\domain\producao.service.ts` | Linha 1285 | `operacoes_producao` | Não | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1302 | `operacoes_producao` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1328 | `operacoes_producao` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1353 | `vw_operacoes_producao_resumo_dia` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1369 | `operacoes_producao` | Sim | Não | SIM |
| `src\services\domain\producao.service.ts` | Linha 1400 | `operacao_producao_materiais` | Não | Não | SIM |
| `src\services\domain\servicos_especificos.service.ts` | Linha 58 | `servicos_especificos_regras` | Sim | Não | SIM |
| `src\services\domain\servicos_especificos.service.ts` | Linha 90 | `servicos_especificos_regras` | Não | Não | SIM |
| `src\services\domain\servicos_especificos.service.ts` | Linha 102 | `servicos_especificos_regras` | Não | Não | SIM |
| `src\services\domain\servicos_especificos.service.ts` | Linha 118 | `servicos_especificos_regras` | Não | Não | SIM |
| `src\services\domain\servicos_especificos.service.ts` | Linha 138 | `servicos_especificos_lancamentos` | Não | Não | SIM |
| `src\services\domain\servicos_especificos.service.ts` | Linha 153 | `servicos_especificos_lancamentos` | Sim | Não | SIM |
| `src\services\financial.service.ts` | Linha 24 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\financial.service.ts` | Linha 34 | `lotes_remessa` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 51 | `faturas` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 57 | `faturas` | Sim | Não | SIM |
| `src\services\financial.service.ts` | Linha 60 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\financial.service.ts` | Linha 61 | `colaboradores` | Sim | Não | SIM |
| `src\services\financial.service.ts` | Linha 88 | `rh_financeiro_lote_itens` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 100 | `faturas` | Sim | Não | SIM |
| `src\services\financial.service.ts` | Linha 110 | `contas_bancarias_empresa` | Sim | Não | SIM |
| `src\services\financial.service.ts` | Linha 167 | `rh_financeiro_lote_itens` | Sim | Não | SIM |
| `src\services\financial.service.ts` | Linha 174 | `faturas` | Sim | Não | SIM |
| `src\services\financial.service.ts` | Linha 208 | `contas_bancarias_empresa` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 348 | `cnab_retorno_itens` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 397 | `financeiro_conciliacoes` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 427 | `clientes` | Sim | Não | SIM |
| `src\services\financial.service.ts` | Linha 438 | `faturas` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 454 | `financeiro_consolidados_cliente` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 464 | `faturas` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 474 | `faturas` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 484 | `faturas` | Não | Não | SIM |
| `src\services\financial.service.ts` | Linha 489 | `faturas` | Não | Não | SIM |
| `src\services\governance.service.ts` | Linha 97 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\governance.service.ts` | Linha 111 | `rh_financeiro_lote_historico` | Não | Não | SIM |
| `src\services\governance.service.ts` | Linha 135 | `vw_audit_timeline_operacional` | Não | Não | SIM |
| `src\services\inadimplencia.service.ts` | Linha 32 | `receitas_operacionais` | Sim | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 99 | `ciclos_operacionais` | Sim | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 171 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 185 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 200 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 220 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 242 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 254 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 278 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 289 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 305 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 312 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 328 | `ciclos_operacionais` | Sim | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 347 | `ciclos_operacionais` | Sim | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 373 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 380 | `ciclos_operacionais` | Não | Não | SIM |
| `src\services\operationalEngine\CicloOperacionalService.ts` | Linha 395 | `auditoria_workflow_ciclos` | Não | Não | SIM |
| `src\services\operationalEngine\Logger.ts` | Linha 34 | `motor_auditoria_logs` | Não | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 6 | `clientes` | Não | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 11 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 14 | `transportadoras` | Não | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 17 | `transportadoras_clientes` | Não | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 44 | `financeiro_consolidados_cliente` | Sim | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 65 | `operacoes_producao` | Sim | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 92 | `colaboradores` | Sim | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 177 | `financeiro_consolidados_cliente` | Sim | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 191 | `faturas` | Sim | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 201 | `financeiro_calculos_memoria` | Sim | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 222 | `financeiro_consolidados_colaborador` | Sim | Não | SIM |
| `src\services\operationalEngine\MotorFinanceiro.ts` | Linha 232 | `faturas` | Sim | Não | SIM |
| `src\services\preCadastroColaborador.service.ts` | Linha 124 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\preCadastroColaborador.service.ts` | Linha 134 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\preCadastroColaborador.service.ts` | Linha 159 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\preCadastroColaborador.service.ts` | Linha 281 | `colaboradores` | Não | Não | SIM |
| `src\services\preCadastroColaborador.service.ts` | Linha 322 | `colaboradores` | Sim | Não | SIM |
| `src\services\preCadastroColaborador.service.ts` | Linha 377 | `colaboradores` | Sim | Não | SIM |
| `src\services\preCadastroColaborador.service.ts` | Linha 387 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\receitas\receitas.service.ts` | Linha 13 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\receitas\receitas.service.ts` | Linha 18 | `receitas_operacionais` | Sim | Não | SIM |
| `src\services\receitas\receitas.service.ts` | Linha 61 | `receitas_operacionais` | Não | Não | SIM |
| `src\services\receitas\receitas.service.ts` | Linha 86 | `receitas_operacionais_historico` | Não | Não | SIM |
| `src\services\receitas\receitas.service.ts` | Linha 139 | `receitas_operacionais` | Não | Não | SIM |
| `src\services\receitas\receitas.service.ts` | Linha 162 | `receitas_operacionais` | Não | Não | SIM |
| `src\services\receitas\receitas.service.ts` | Linha 181 | `servicos_extras_operacionais` | Sim | Não | SIM |
| `src\services\receitas\receitas.service.ts` | Linha 201 | `servicos_extras_operacionais` | Não | Não | SIM |
| `src\services\receitas\receitas.service.ts` | Linha 212 | `servicos_extras_operacionais` | Não | Sim | Não |
| `src\services\receitas\receitas.service.ts` | Linha 222 | `empresas` | Não | Sim | Não (Ignorado/Tabela Base) |
| `src\services\receitas\receitas.service.ts` | Linha 306 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\receitas\receitas.service.ts` | Linha 340 | `servicos_extras_operacionais` | Não | Não | SIM |
| `src\services\report.service.ts` | Linha 12 | `relatorios_favoritos` | Não | Não | SIM |
| `src\services\report.service.ts` | Linha 21 | `relatorios_favoritos` | Não | Não | SIM |
| `src\services\report.service.ts` | Linha 28 | `relatorios_favoritos` | Não | Não | SIM |
| `src\services\report.service.ts` | Linha 32 | `relatorios_favoritos` | Não | Não | SIM |
| `src\services\report.service.ts` | Linha 40 | `relatorios_agendamentos` | Não | Não | SIM |
| `src\services\report.service.ts` | Linha 48 | `relatorios_agendamentos` | Não | Não | SIM |
| `src\services\report.service.ts` | Linha 53 | `relatorios_agendamentos` | Não | Não | SIM |
| `src\services\report.service.ts` | Linha 58 | `relatorios_agendamentos` | Não | Não | SIM |
| `src\services\resetOperacional.service.ts` | Linha 45 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\rhFinanceiro.service.ts` | Linha 144 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\rhFinanceiro.service.ts` | Linha 172 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\rhFinanceiro.service.ts` | Linha 174 | `registros_ponto` | Sim | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 181 | `colaboradores` | Sim | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 186 | `processamento_rh_inconsistencias` | Sim | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 193 | `processamento_rh_logs` | Sim | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 226 | `custos_extras_operacionais` | Sim | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 233 | `servicos_extras_operacionais` | Sim | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 335 | `banco_horas_eventos` | Sim | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 386 | `rh_financeiro_lote_historico` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 729 | `rh_financeiro_lotes` | Sim | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 758 | `rh_financeiro_lote_itens` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 759 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 781 | `rh_financeiro_lote_itens` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 806 | `rh_financeiro_lotes` | Sim | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 838 | `rh_financeiro_lote_itens` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 884 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\rhFinanceiro.service.ts` | Linha 890 | `rh_financeiro_lotes` | Sim | Sim | Não |
| `src\services\rhFinanceiro.service.ts` | Linha 917 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 930 | `rh_financeiro_lote_historico` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 952 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 969 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 981 | `rh_financeiro_lote_historico` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 997 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 1019 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 1081 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 1098 | `rh_financeiro_lotes` | Não | Não | SIM |
| `src\services\rhFinanceiro.service.ts` | Linha 1111 | `rh_financeiro_lote_historico` | Não | Sim | Não |
| `src\services\rhFinanceiro.service.ts` | Linha 1128 | `empresas` | Sim | Sim | Não (Ignorado/Tabela Base) |
| `src\services\rhFinanceiro.service.ts` | Linha 1134 | `rh_financeiro_lotes` | Sim | Sim | Não |
| `src\services\rhProcessing.service.ts` | Linha 335 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\rhProcessing.service.ts` | Linha 392 | `banco_horas_regras` | Sim | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 633 | `registros_ponto` | Não | Sim | Não |
| `src\services\rhProcessing.service.ts` | Linha 668 | `banco_horas_saldos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 702 | `processamento_rh_inconsistencias` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 729 | `processamento_rh_inconsistencias` | Sim | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 736 | `banco_horas_saldos` | Sim | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 760 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 767 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 774 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 779 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 806 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 866 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 893 | `registros_ponto` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 903 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 951 | `banco_horas_saldos` | Sim | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 958 | `fechamento_mensal` | Sim | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1017 | `processamento_rh_logs` | Sim | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1121 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1125 | `processamento_rh_inconsistencias` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1384 | `registros_ponto` | Sim | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1429 | `registros_ponto` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1435 | `registros_ponto` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1477 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1501 | `banco_horas_saldos` | Sim | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1542 | `registros_ponto` | Sim | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1567 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1573 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1583 | `processamento_rh_inconsistencias` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1588 | `registros_ponto` | Não | Não | SIM |
| `src\services\rhProcessing.service.ts` | Linha 1624 | `fechamento_mensal` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 44 | `banco_horas_regras` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 49 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\v4.service.ts` | Linha 101 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\v4.service.ts` | Linha 130 | `banco_horas_saldos` | Não | Não | SIM |
| `src\services\v4.service.ts` | Linha 159 | `banco_horas_saldos` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 186 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\v4.service.ts` | Linha 211 | `colaboradores` | Não | Não | SIM |
| `src\services\v4.service.ts` | Linha 333 | `banco_horas_eventos` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 351 | `banco_horas_eventos` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 394 | `colaboradores` | Não | Não | SIM |
| `src\services\v4.service.ts` | Linha 485 | `banco_horas_eventos` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 550 | `banco_horas_eventos` | Não | Não | SIM |
| `src\services\v4.service.ts` | Linha 576 | `banco_horas_saldos` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 579 | `banco_horas_eventos` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 718 | `colaboradores` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 723 | `colaboradores` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 743 | `empresas` | Sim | Não | Não (Ignorado/Tabela Base) |
| `src\services\v4.service.ts` | Linha 825 | `banco_horas_eventos` | Sim | Não | SIM |
| `src\services\v4.service.ts` | Linha 839 | `colaboradores` | Não | Não | SIM |
| `src\services\v4.service.ts` | Linha 842 | `empresas` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\v4.service.ts` | Linha 845 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
| `src\services\v4.service.ts` | Linha 1035 | `perfis_usuarios` | Não | Não | SIM |
| `src\services\v4.service.ts` | Linha 1072 | `profiles` | Não | Não | Não (Ignorado/Tabela Base) |
