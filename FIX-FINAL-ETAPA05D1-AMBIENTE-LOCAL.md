# ERP ORBE — FIX-FINAL / ETAPA 05D.1
# Diagnóstico e Inicialização do Supabase Local

> **Data de Emissão:** 12/10/2026  
> **Responsável:** Antigravity Pairing Agent  
> **Status:** Diagnóstico Concluído — Inicialização Interrompida por Falha em Migration Legada (Containers encerrados com segurança pela CLI)  
> **Isolamento:** 100% Local (Zero conexões com banco remoto de produção, Zero alterações de config, Zero escritas Git)  

---

## 1. RESUMO EXECUTIVO

Durante a execução da **ETAPA 05D.1**, todos os pré-requisitos de infraestrutura e virtualização foram validados com êxito:
1. O **Docker Engine 28.1.1** foi inicializado e respondeu com sucesso às chamadas de API via WSL2.
2. A **Supabase CLI 2.120.0** realizou o download completo de **todas as 11 imagens Docker oficiais** (Postgres 17, PostgREST, Kong, Gotrue, Realtime, Studio, Storage-API, Vector, Logflare, Mailpit e Edge-Runtime).
3. Todas as portas locais (`54320` a `54329`) estavam completamente livres de conflitos.
4. O container de banco subiu com sucesso e iniciou a esteira sequencial de migrations (`Initialising schema...`).

Contudo, a inicialização automática foi **interrompida pela CLI** na 2ª migration da fila (`20260420_admin_override_refinement.sql`), impedindo a subida dos demais serviços e a aplicação das 259 migrations subsequentes (incluindo a migration alvo 05B).

---

## 2. STATUS DOS COMPONENTES E SERVIÇOS

| Componente | Status | Detalhes |
| :--- | :---: | :--- |
| **Docker Desktop Engine** | `OPERACIONAL` | Versão 28.1.1, WSL2 kernel 6.18.40.1, Linux x86_64 ativo |
| **Supabase CLI** | `OPERACIONAL` | Versão 2.120.0 executada via `npx` |
| **Imagens Docker Locais** | `BAIXADAS (100%)` | 11 imagens cacheadas localmente (~7.5 GB no Docker Engine) |
| **Conexão Remota / Nuvem** | `ISOLADO (NULL)` | `linked_project: null`. Nenhuma conexão com produção |
| **Containers Locais** | `PARADOS (OFFLINE)` | A CLI finalizou os containers devido a erro na migration 20260420 |
| **Serviços Ativos (Portas)** | `NENHUM` | Nenhuma porta 5432x aberta no momento |

---

## 3. DIAGNÓSTICO DETALHADO DO ERRO NA MIGRATION

### 3.1 Ponto Exato da Falha
A CLI iniciou o banco de dados e começou a processar os arquivos SQL da pasta `supabase/migrations/`:

```text
Starting database...
Initialising schema...
Seeding globals from roles.sql...
Applying migration 20260419022956_initial_schema.sql... [OK]
Applying migration 20260420_admin_override_refinement.sql... [FALHA]
Stopping containers...
```

### 3.2 Mensagem de Erro Emitida pela Engine
```json
{
  "_tag": "Error",
  "error": {
    "code": "MigrationApplyError",
    "message": "ERROR: schema \"audit\" does not exist (SQLSTATE 3F000)\nAt statement: 0\n-- 1. Tornar logs de auditoria imutáveis\r\nDO $$ \r\nBEGIN\r\n    -- Impedir UPDATE e DELETE em audit.logs\r\n    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'protect_audit_logs') THEN\r\n        CREATE OR REPLACE FUNCTION audit.prevent_alteration() RETURNS TRIGGER AS $body$\r\n        BEGIN\r\n            RAISE EXCEPTION 'Registros de auditoria são imutáveis e não podem ser alterados ou removidos.';\r\n        END;\r\n        $body$ LANGUAGE plpgsql;\r\n\r\n        CREATE TRIGGER protect_audit_logs\r\n        BEFORE UPDATE OR DELETE ON audit.logs\r\n        FOR EACH ROW EXECUTE FUNCTION audit.prevent_alteration();\r\n        \r\n        CREATE TRIGGER protect_audit_overrides\r\n        BEFORE UPDATE OR DELETE ON audit.overrides\r\n        FOR EACH ROW EXECUTE FUNCTION audit.prevent_alteration();\r\n    END IF;\r\nEND $$"
  }
}
```

### 3.3 Causa Raiz
O arquivo histórico `supabase/migrations/20260420_admin_override_refinement.sql` assume a existência do schema `audit`, porém a migration inicial `20260419022956_initial_schema.sql` não executa `CREATE SCHEMA IF NOT EXISTS audit;`.

Como a Supabase CLI 2.120.0 adota integridade estrita por padrão:
- Qualquer falha em qualquer migration intermediária aborta o bootstrap e encerra os containers (`Stopping containers...`).
- O erro ocorreu na **2ª migration** de um total de **261 migrations**.

---

## 4. STATUS DA MIGRATION ALVO (05B)

- **Arquivo:** `supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`
- **Posição na Fila:** 261ª migration (última).
- **Status no Banco Local:** **NÃO APLICADA**. A esteira foi interrompida no script nº 2.
- **Status no Banco Remoto:** **NÃO APLICADA** (preservação estrita das restrições de produção).

---

## 5. RESPOSTAS OBJETIVAS AOS QUESTIONAMENTOS DA ETAPA 05D.1

1. **A inicialização terminou com sucesso ou erro?**  
   Terminou com erro de aplicação de migration histórica (`MigrationApplyError` na migration `20260420_admin_override_refinement.sql`).

2. **Quais serviços locais estão ativos?**  
   Nenhum serviço permanece ativo no momento. Todos os containers foram desligados pela CLI para manter a consistência do banco após o erro. As imagens Docker, no entanto, já estão todas baixadas no host.

3. **Houve falha em alguma das 261 migrations identificadas anteriormente?**  
   Sim, falha na migration `20260420_admin_override_refinement.sql` por ausência do schema `audit` (`SQLSTATE 3F000`).

4. **A migration `20261012120000_etapa05b_retificacao_intermitentes_rh.sql` foi aplicada no banco LOCAL?**  
   Não foi aplicada, pois o processo foi abortado logo na 2ª migration.

5. **Existe algum risco ou impedimento para começar os testes 05D?**  
   Sim. O impedimento imediato é a indisponibilidade do banco local ativo enquanto o bloqueio da esteira de migrations não for contornado.

---

## 6. PROPOSTAS SEGURAS PARA DESTRAVAMENTO (AGUARDANDO APROVAÇÃO)

Para viabilizar a homologação local sem tocar em produção ou quebrar o histórico:

### Estratégia 1 — Desativar Migrations Automáticas no `config.toml` (Mais Rápida e Isolada)
Configurar temporariamente no [`supabase/config.toml`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/config.toml):
```toml
[db.migrations]
enabled = false
```
Em seguida:
1. Executar `npx supabase start` (os containers sobem imediatamente limpos em segundos, pois as imagens já estão baixadas).
2. Executar via `psql` local (`127.0.0.1:54322`) o script consolidado de tabelas dos Intermitentes + a migration 05B + o seed sintético de homologação (`supabase/seed_etapa05c_homologacao.sql`).
3. Executar os 14 testes funcionais de retificação com 100% de isolamento e fidelidade.

### Estratégia 2 — Correção Cirúrgica da Migration Histórica `20260420`
Adicionar `CREATE SCHEMA IF NOT EXISTS audit;` no topo de `20260420_admin_override_refinement.sql`.  
*Risco técnico:* Outras migrations legadas de abril/maio com dependências de dados mockados podem apresentar erros sequenciais subsequentes.

### Estratégia 3 — PostgreSQL 17.5 Nativo do Host (`C:\pgsql\bin`)
Iniciar um cluster temporário local via `initdb` + `pg_ctl` na porta `54322` e carregar diretamente a migration 05B e o seed, sem depender de Docker ou da fila de 261 migrations.

---

> **Ação atual:** Diagnóstico concluído e documentado. Aguardando decisão do operador para autorizar o procedimento de destravamento antes de iniciar a execução dos testes.
