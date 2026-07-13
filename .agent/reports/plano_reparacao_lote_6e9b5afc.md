# RELATÓRIO: PLANO DE REPARAÇÃO LOTE 6e9b5afc

**Lote Original:** `6e9b5afc-e2f0-4ae8-b0ef-9c581da5e8f0`
**Status da Ação:** Script SQL gerado e pronto para execução

Dada a impossibilidade de executar o reparo via Node.js local devido a políticas rígidas de **Row Level Security (RLS)** na API no acesso "ANON", o reparo deve ser aplicado **diretamente via Banco de Dados (Supabase SQL Editor)** ou através do CLI autenticado por token de serviço.

## Etapas da Reparação (Script `.agent/scripts/repara_lote_6e9b5afc.sql`)

### 1. Invalidação do Lote Antigo (ETAPA 05)
A instrução preserva o lote histórico e, primeiramente, o atualiza para o status `CANCELADO` (ou correspondente disponível). 
Sua coluna de `observacoes` recebe o seguinte alerta fixado: 
> "Lote invalidado por agrupamento indevido de lançamentos pertencentes a múltiplas empresas. Substituído por lotes segregados por empresa."

### 2. Particionamento Matemático por Empresa (ETAPA 06 e 07)
O script escaneia a ramificação de 11 lançamentos vinculados e:
- Agrupa todas as entidades por `empresa_id` em memória transacional.
- Executa um loop criando exatamente 3 novos lotes particionados.
- Relaciona as partes antigas da sublista de 11 para o IDs dos novos lotes recém cadastrados.
- Altera os Lançamentos e o ID-Pai de volta para `EM_ANALISE_RH` e o Lote para `AGUARDANDO_VALIDACAO_RH`, reinstituindo as avaliações no painel do ERP oficialmente.

### 3. Saneamento e Proteção (ETAPA 04)
Após a fragmentação concluída, todos os resíduos históricos de Lotes Nulos recebem atribuição estrita para que não firam Constraints PostgreSQL, e imediatamente o SQL realiza um `EXECUTE 'ALTER TABLE intermitentes_lotes_fechamento ALTER COLUMN empresa_id SET NOT NULL'`. 
Isto formaliza o bloqueio estrutural para sempre na arquitetura do Orbe.

---

O usuário deve colar e rodar o DO Block disponível em `.agent/scripts/repara_lote_6e9b5afc.sql` pelo **Supabase Dashboard**, comprovando seus efeitos matemáticos expostos pelo Output e Log do Postgres (`RAISE NOTICE`).
