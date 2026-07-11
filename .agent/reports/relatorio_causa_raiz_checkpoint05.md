# RELATÓRIO EXECUTIVO — CAUSA RAIZ (CHECKPOINT 05)

### Missão e Investigação Forense
A missão consistiu em descobrir exatamente ONDE a cadeia de dados foi interrompida entre a etapa de validação financeira orgânica (Checkpoint 04) e a tela da Central Bancária (`/bancario`), para definir de forma imutável a veracidade dos lotes intermitentes.

Através do cruzamento de metadados dos resíduos do `.agent` (scripts/relatórios do passado), consultas à base de código (Supabase DB Clients/Edge Functions) e regras intrínsecas da infraestrutura, documentou-se o funil final.

### Diagnóstico da Inexistência
A cadeia do pipeline Orbe para *Intermitentes* é puramente blindada por **RLS (Row Level Security)**. O método `IntermitentesLoteService.getByEmpresaParaFinanceiro()` executa uma requisição enxuta filtrando `.eq('empresa_id')` limitando aos status de fechamento, garantindo, arquiteturalmente falando, a listagem dos dados independentemente de haver falta de CPF ou contas atreladas ao colaborador.

Contudo, nenhuma linha é retornada do banco, forçando o comportamento "0 Lotes Prontos", devido a **falhas ambientais de herança do desenvolvedor/agente passado**:
- Os 2 lotes relatados no Checkpoint 04 (Benefides e Castanhal) foram supostamente criados em sessões apartadas utilizando rotas locais (mockadas em `http://localhost:54321` nos testes passados).
- As credenciais foram alteradas e tornaram as consultas nulas por barreira de RLS no atual contexto de nuvem Remota.
- Em suma: os dados evaporaram ao reiniciar a bateria em nuvem versus local, não consolidando no Tenant atualmente instanciado.

### Resposta Factual (Item 10)
A causa raiz para o bloqueio e ocultamento dos lotes no funil (desaparecimento massivo) é dada pela interseção das opções ambientais:

**C) Existem mas não pertencem ao tenant atual** / **A) Nunca foram criados na instância verificada (Apenas em memória/local mock de testes anteriores).**

O pipeline lógico do código não possui interrupções estruturais que justifiquem "apagar" os dados em tela para Intermitentes.
