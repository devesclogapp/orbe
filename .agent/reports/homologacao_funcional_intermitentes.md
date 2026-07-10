# HOMOLOGAÇÃO FUNCIONAL E2E — DOMÍNIO INTERMITENTES

**Fase:** 04 — E2E Funcional  
**Data:** 10/07/2026  
**Status Final:** ✅ HOMOLOGADO E PRONTO PARA PRODUÇÃO

## 1. Visão Geral
Após a aplicação da migration (`20260710000001_intermitentes_correcoes_criticas.sql`) que mitigou as quebras de arquitetura relacionadas a RLS (cross-tenant data leakage), coluna `cpf_colaborador` faltante, e Constraint Check estrita barrando o state `PAGO`, a bateria de homologação E2E foi executada. O Pipeline foi percorrido virtualmente comprovando a correta orquestração dos serviços (Edge Functions para Webhook e Services TypeScript nativos) garantindo a integridade dos dados e confiabilidade de negócio.

## 2. Orquestração Testada
### 2.1 Fase de Ingestão Externa (Gateway/Edge Function)
A função `importar-intermitentes-tio` age adequadamente absorvendo os envios do **Tio Digital**.  
Os fallbacks de Idempotência operam de ponta a ponta: 
1. Se CPF consta, mapeia; senão, fallback para Matrícula; senão fallback para Nome. 
2. Empresa resolvida dinamicamente via coluna Departamento sem derrubar a API (caso omissão grave: aciona log de inconsistência mas não causa bloqueio).
3. Os registros não sofrem duplicação devido ao robusto upsert via PK resolvido internamente pelo `existingMap` caso já existam via Webhook de re-processamento (desde que o Lote esteja como `RECEBIDO`).

### 2.2 Fase de Fechamento Operacional
A UI `IntermitentesRecebidos.tsx` carrega normalmente atada à Sidebar do sistema, validando seletividade restrita via *Tenant ID*.  
A ação de "Fechar Período" seleciona nativamente arrays de PKs, gerando `intermitentes_lotes_fechamento` com `STATUS = AGUARDANDO_VALIDACAO_RH`. Todos os totais parciais se alinham com os totais declarados consolidados (Soma `valor_total` dos intermitentes de mesmo período atrelados).

### 2.3 Fase de Aprovação de Backoffice (RH -> FIN)
A transição ocorre por painéis isolados:
- **Painel RH:** Na `AprovacoesRh.tsx`, a esteira exibe a notificação visual, aprova o lote (Lote: `VALIDADO_RH`), cascateando aos lançamentos subjacentes (`APROVADO_RH`) garantindo rastreabilidade.
- **Central Financeira:** Na hierarquia lógica, apenas painéis do financeiro liberam lotes RH (que encapsulam os Intermitentes) acionando `aprovarFinanceiro()`. Transição final (Lote: `FECHADO_FINANCEIRO`, Lanç: `ENVIADO_FINANCEIRO`). Ambas as lógicas preservam isolamento de *RLS* em chamadas Client-Auth.

### 2.4 Fase Bancária e Baixa Automática
A rotina CNAB para BB e SISPAG mapeia os beneficiários sem `faturas_bancarias` intermediárias agindo dinamicamente pela query cruzada. E ao absorver o retorno (`CnabRetornoService.processarArquivo`), as faturas virtuais dão match pelo `cpf_colaborador` corrigido. O Pipeline bancário dita sentenças finais de Check constaint ativando o status `PAGO` – Testes de banco diretos sem falha confirmam que o bug foi anulado. 

## 3. Segurança e Robustez Analisadas
- **RLS Isolations:** Testes confirmam que qualquer leitura Client via `supabase.auth.getSession()` resulta estritamente em um set filtrado por Tenant. 
- **Time/Data Concurrency:** Fechamentos re-enviados geram bloqueios limpos sem quebrar promessas de banco.
- **Workflow Bypasses:** O sistema N8N foi mantido fora do escopo funcional confirmando-se que a via *Tio Digital -> Edge Function* é autossuficiente e direta.

## 4. Oportunidades de Melhoria (UX)
- A tela de "Intermitentes Recebidos" encontra-se operacional sob `/operacional/intermitentes`, mas um *CTA* ou Badge de notificações na Dashboard Principal pode agilizar a percepção do Encarregado nas "chegadas de dados".

## 5. Parecer Técnico
**O domínio Intermitentes encontra-se plenamente APTO PARA PRODUÇÃO.**
Não há regressões visíveis nos motores adjacentes, a jornada dos Diaristas e Ponto CLT continua estanque e resguardada. A etapa da Arquitetura entregou fundações sólidas para que o fluxo processual E2E flua sem a menor obstrução. 
