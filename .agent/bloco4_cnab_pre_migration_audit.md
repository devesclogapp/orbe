# PRÉ-MIGRATION AUDIT (Bloco 4: CNAB e Retorno)

## 1. Mapeamento das Colunas Atuais
Baseado na leitura das migrations originais (`20260507202600_cnab_remessas_arquivos.sql` e `20260507213000_cnab_retorno_bb.sql`):

### Tabela: `cnab_remessas_arquivos`
- **Chaves Primárias/Estrangeiras**:
  - `id` (UUID, PK)
  - `tenant_id` (UUID, FK para tenants) **[JÁ É NOT NULL e CASCADE]**
  - `lote_id` (UUID, FK para lotes_remessa) [NULLABLE]
  - `conta_bancaria_id` (UUID, FK para contas_bancarias_empresa) [NULLABLE]
  - `usuario_geracao`, `usuario_envio`, `usuario_homologacao`
- **Falta adicionar**: 
  - `empresa_id` (para consolidar o escopo direto, já que passará a guardar remessas de múltiplas origens, e o `lote_id` pode não cobrir Diaristas ou Intermitentes).

### Tabela: `cnab_retorno_arquivos` e `cnab_retorno_itens`
- Ambas já possuem `tenant_id NOT NULL` e RLS por Tenant.
- `cnab_retorno_itens` tem chaves frouxas para faturas, colaboradores, lotes, etc., mas não consolida numa estrutura própria para remessas genéricas.

### Tabela nova necessária: `cnab_remessa_itens`
Atualmente não existe uma tabela interligando as remessas aos itens faturáveis de forma polimórfica (CLT vs Intermitente vs Diarista). A migração **deve** criar essa tabela do zero com as colunas acordadas.

## 2. Índices e Constraints de Idempotência Atuais
- Em `cnab_remessas_arquivos`:
  - `idx_cnab_remessas_arquivos_sequencial (tenant_id, conta_bancaria_id, sequencial_arquivo)`
  - `idx_cnab_remessas_arquivos_hash (tenant_id, hash_arquivo)` (Este já resolve indiretamente o que foi solicitado!)

## 3. Diagnóstico de Backfill
Dado que o `empresa_id` deverá ser acoplado à `cnab_remessas_arquivos`, o backfill para os registros legados deverá seguir a prioridade:
1. Extrair de `contas_bancarias_empresa(id).empresa_id` usando um UPDATE com INNER JOIN.
2. Como fallback (caso `conta_bancaria_id` seja NULL), extrair de `lotes_remessa(id).empresa_id` ou afins.
3. Se restarem nulls após esse JOIN (registros órfãos), eles deverão ser flagados administrativamente.

**Relações sem origem/conta:** 
Existem potenciais arquivos de remessa legados com `conta_bancaria_id = null`. Estes precisarão ser monitorados no Gate do Backfill (Etapa 4) antes da aplicação do `NOT NULL`.

## Conclusão de Planejamento de Migração (Migration A)
1. Criar Migration `.sql` que adiciona `empresa_id UUID REFERENCES empresas(id)` na tabela `cnab_remessas_arquivos`.
2. Criar a nova tabela completa `cnab_remessa_itens` já com NOT NULL nas chaves polimórficas (pois será vazia no nascimento).
3. Adicionar o índice composto/idempotente proposto para `cnab_remessa_itens`: `UNIQUE(tenant_id, origem_tipo, origem_id) WHERE status NOT IN ('CANCELADA', 'INVALIDADA')`.
