# COMANDO EXECUTIVO — ORBE ERP

Use a documentação mestre do ORBE ERP como referência de arquitetura.

OBJETIVO:
Implementar o fluxo operacional completo e estável:

ENTRADAS
→ RH
→ APROVAÇÃO RH
→ LOTE FINANCEIRO
→ ANÁLISE FINANCEIRA
→ APROVAÇÃO FINANCEIRA
→ PREPARAÇÃO PARA CNAB
→ GOVERNANÇA/LOGS

NÃO implementar IA agora.
NÃO refatorar o sistema inteiro.
NÃO recriar telas existentes.
NÃO quebrar rotas, services, banco de horas, processamento RH ou financeiro atual.

---

# PRIORIDADE 1 — RH → FINANCEIRO

Implementar/validar:

1. Processamento RH
- botão Aprovar Competência
- validação de bloqueios críticos
- separação entre bloqueios e avisos
- geração de lote financeiro
- status APROVADO_RH
- status lote AGUARDANDO_FINANCEIRO

2. Tabela/Lógica de Lote
- usar/criar rh_financeiro_lotes
- impedir duplicidade por tenant_id, empresa_id, competencia, origem, tipo
- criar itens do lote vinculados aos eventos RH
- registrar usuário, data e origem

3. Central Financeira
- aba Lotes do RH
- badge de pendentes
- tabela com empresa, competência, valor, quantidade e status
- botão Analisar
- modal com itens detalhados

4. Financeiro
- permitir Aprovar Financeiro
- permitir Devolver ao RH com motivo obrigatório
- status:
  - AGUARDANDO_FINANCEIRO
  - EM_ANALISE_FINANCEIRA
  - APROVADO_FINANCEIRO
  - DEVOLVIDO_RH

5. Governança
- registrar logs para:
  - aprovação RH
  - criação de lote
  - análise financeira
  - aprovação financeira
  - devolução ao RH

---

# PRIORIDADE 2 — MODELO DE CÁLCULO DO COLABORADOR

Implementar sem quebrar cadastros existentes:

Campos:
- regime_trabalho
- modelo_calculo

Opções regime:
- CLT
- Intermitente
- Diarista
- Freelancer
- Terceirizado

Opções modelo:
- Mensal
- Horista
- Diária
- Produção

Campos dinâmicos:
- Mensal: salário base
- Horista: valor hora, carga referência, estimativa mensal
- Diária: valor diária
- Produção: valor operação ou regra operacional

Compatibilidade:
- CLT atual → regime CLT / modelo Mensal
- Diarista → regime Diarista / modelo Diária

---

# PRIORIDADE 3 — FECHAMENTO

Melhorar fluxo sem recriar tela:

Fechamento deve acompanhar:
ENTRADAS
→ RH
→ FINANCEIRO
→ BANCÁRIO
→ FECHADO

Implementar:
- status por competência
- bloqueios visíveis
- impedir fechamento com pendências críticas
- permitir fechamento apenas após aprovação financeira
- logs de congelamento

---

# PRIORIDADE 4 — PREPARAÇÃO CNAB

Não gerar pagamento real ainda se não estiver estável.

Preparar somente:
- lote aprovado financeiro
- status AGUARDANDO_PAGAMENTO
- envio para tela Bancário/CNAB
- manter rastreabilidade

---

# REGRAS GERAIS

Sempre:
- preservar o que já funciona
- implementar incrementalmente
- reaproveitar telas existentes
- não criar módulos duplicados
- não alterar rotas sem necessidade
- manter multiempresa/tenant
- manter isolamento de sessão
- validar build ao final

---

# CRITÉRIOS DE ACEITE

Ao final, o sistema deve permitir:

1. RH processa competência
2. RH aprova competência
3. Sistema cria lote financeiro
4. Central Financeira recebe lote
5. Financeiro analisa lote
6. Financeiro aprova ou devolve ao RH
7. Lote aprovado fica pronto para etapa bancária/CNAB
8. Todas as ações possuem logs
9. Nenhuma tela existente quebra
10. npm run build passa com sucesso

---

# EXECUÇÃO

Antes de alterar:
1. localizar arquivos atuais envolvidos
2. identificar services existentes
3. reaproveitar componentes
4. listar brevemente o plano técnico

Depois:
1. implementar
2. rodar build
3. corrigir erros
4. entregar resumo do que foi alterado
5. listar o que ficou pendente