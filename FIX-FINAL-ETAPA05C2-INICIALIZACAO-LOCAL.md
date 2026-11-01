# ERP ORBE — FIX-FINAL / ETAPA 05C.2
# Inicialização Controlada do Supabase Local

> **Data de Emissão:** 12/10/2026  
> **Responsável:** Antigravity Pairing Agent  
> **Status:** Diagnóstico e Pré-Inicialização Concluídos (Estritamente READ-ONLY — Zero containers iniciados, Zero alterações remotas)  
> **Arquivo Analisado:** [`supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql)  
> **Massa Sintética Pronta:** [`supabase/seed_etapa05c_homologacao.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/seed_etapa05c_homologacao.sql)  

---

## 1. OBJETIVO DA ETAPA

Verificar os pré-requisitos para inicialização do Supabase local em Docker, inspecionar se a CLI local aponta para destino isolado, auditar a cadeia de migrations necessárias para reproduzir o schema dos Intermitentes e atestar a segurança antes da execução dos 14 testes de homologação.

---

## 2. ETAPA 1 — VERIFICAÇÕES DE INFRAESTRUTURA

### 2.1 Status do Docker
- **Docker CLI:** Instalado na versão `28.1.1` (`C:\Program Files\Docker\cli-plugins`).
- **Executável Desktop:** Localizado em `C:\Program Files\Docker\Docker\Docker Desktop.exe`.
- **Serviço do Windows (`com.docker.service`):** Status `Stopped`.
- **Daemon / Engine Named Pipe:** Inativo no momento:
  ```text
  error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.49/info": 
  open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
  ```
- **Ambiente WSL:** `wsl -l -v` reportou nenhuma distribuição Linux instalada no host Windows.
- **Diagnóstico:** O Docker Desktop está instalado, mas precisa ser iniciado interativamente pelo operador no Windows para abrir o engine Linux/Hyper-V.

### 2.2 Status da Supabase CLI e Isolamento de Destino
- **Versão Instalada:** `supabase@2.120.0` (executável via `npx supabase`).
- **Verificação de Vínculo (`supabase status`):**
  ```json
  {
    "linked_project": null,
    "_tag": "Error",
    "error": {
      "code": "StatusDbInspectError",
      "message": "failed to inspect container health: error during connect: Get \"http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/...\""
    }
  }
  ```
- **Confirmação de Isolamento:** O comando `supabase status` confirmou explicitamente `"linked_project": null` para operações locais.
- **Garantia de Destino:** Nenhum comando local (`supabase start`, `supabase db reset`) envia requisições para a nuvem. Todos os endpoints configurados em [`supabase/config.toml`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/config.toml) apontam para `localhost` (`127.0.0.1:54321` para API e `127.0.0.1:54322` para DB).

### 2.3 Mecânica de Migrations na Supabase CLI 2.120.0
- Quando `supabase start` é executado, a CLI:
  1. Cria e inicia a rede Docker local.
  2. Sobe o container Postgres (`supabase_db_Orbe`) na porta `54322`.
  3. Aplica todos os scripts contidos em `supabase/migrations/*.sql` em ordem sequencial de timestamp.
  4. Executa o arquivo `supabase/seed.sql`.
  5. Sobe PostgREST, Kong, Gotrue (Auth) e Studio na porta `54323`.

### 2.4 Auditoria das 261 Migrations Históricas
- A pasta [`supabase/migrations/`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations) contém 261 arquivos de migrations cumulativos.
- A migration alvo [`20261012120000_etapa05b_retificacao_intermitentes_rh.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql) é a **última da fila**.
- **Alerta Técnico:** Executar todas as 260 migrations históricas do zero pode ser lento ou falhar devido a scripts intermediários legados de abril/maio que continham dependências de tenants mockados.
- **Estratégia Recomendada:** Se o `supabase start` apresentar falhas em scripts legados, desativar temporariamente as migrations automáticas em `supabase/config.toml` (`[db.migrations] enabled = false`) e aplicar diretamente o schema consolidado dos Intermitentes + migration 05B + seed sintético.

---

## 3. DESCOBERTA ADICIONAL: POSTGRESQL 17.5 NATIVO DISPONÍVEL

Durante a inspeção técnica, identificou-se que o host possui o PostgreSQL 17.5 instalado nativamente:
- **Localização:** `C:\pgsql\bin`
- **Binários presentes:** `psql.exe` (17.5), `pg_ctl.exe`, `initdb.exe`.
- **Importância Estratégica:** Caso o Docker Desktop enfrente impedimentos de inicialização no Windows (ex: ausência de distros WSL), temos uma **alternativa imediata de execução local**: criar um cluster local temporário via `initdb` + `pg_ctl` na porta `54322`, executar o schema dos Intermitentes, a migration 05B e validar os 14 testes SQL diretamente via `psql` sem depender de virtualização.

---

## 4. SCHEMA DOS INTERMITENTES AUDITADO

Para que os 14 cenários da Etapa 05C sejam executados com fidelidade absoluta, o schema local precisa conter:

1. **`public.tenants`:** Controle multi-tenant do ERP ORBE.
2. **`public.profiles`:** Controle de perfis (`admin`, `rh`, `encarregado`).
3. **`public.empresas`:** Entidade de amarração cadastral e tenant.
4. **`public.colaboradores`:** Cadastros com `tipo_colaborador = 'INTERMITENTE'`.
5. **`public.intermitentes_lotes_fechamento`:** Tabela canônica de agrupamento de lotes.
6. **`public.cnab_remessas_arquivos`:** Controle de remessas bancárias geradas.
7. **`public.audit_log`:** Trilha de auditoria imutável compulsória.
8. **`public.lancamentos_intermitentes`:** Tabela canônica de jornadas com os campos:
   - `total`, `horas_trabalhadas`, `horas_normais`, `he_50`, `he_100`, `hora_noturna`
   - `status_pipeline`, `empresa_id`, `lote_fechamento_id`, `lote_devolvido_origem_id`
9. **Funções e Triggers Oficiais:**
   - `fn_guard_lancamentos_intermitentes_update()` e trigger `trg_guard_lancamentos_intermitentes`
   - `rpc_rh_retificar_intermitente`
   - `rpc_rh_revalidar_lote_devolvido`

---

## 5. REFINAMENTO DE SEGURANÇA DA RPC (SEM `PG_CONTEXT`)

Conforme a análise da Etapa 05C.1, revisamos a autorização da RPC para dispensar o parsing textual de diagnóstico (`PG_CONTEXT`) e adotar exclusivamente primitivas de privilégios nativas do PostgreSQL:

```sql
-- 2. Autorização exclusiva para retificações originadas da RPC rpc_rh_retificar_intermitente.
-- Controles nativos verificáveis no PostgreSQL sem dependência de parsing de strings:
-- A) Contexto de execução elevado SECURITY DEFINER (current_user = 'postgres')
-- B) Flag transacional configurada pela RPC (orbe.in_rpc_retificacao = 'true')
-- C) Perfil autenticado comprovado de governança (RH ou Administrador)
IF (current_user = 'postgres') AND
   (current_setting('orbe.in_rpc_retificacao', true) = 'true') AND
   (lower(trim(coalesce(public.get_user_role(), ''))) IN ('admin', 'super_admin', 'rh')) THEN
    RETURN NEW;
END IF;
```

**Garantia Técnica:** Clientes conectados via PostgREST rodam como `authenticated` e **não possuem permissão para executar `SET ROLE postgres`**. O PostgreSQL só eleva `current_user` para `'postgres'` durante a execução de uma função `SECURITY DEFINER` de sua propriedade. Qualquer tentativa de UPDATE direto pelo cliente é sumariamente barrada pelo trigger.

---

## 6. APTIDÃO PARA EXECUTAR OS 14 TESTES DE HOMOLOGAÇÃO

O arquivo de seed sintético [`supabase/seed_etapa05c_homologacao.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/seed_etapa05c_homologacao.sql) está pronto e preparado para popular exatamente os dados necessários para os 14 testes da matriz:
- **T01:** Retificação legítima de empresa pelo RH (Lote 1, Item 2)
- **T02:** Tentativa de retificação por Encarregado (rejeição 42501)
- **T03:** Tentativa de UPDATE direto de horas via API (rejeição 42501)
- **T04:** Tentativa de bypass por RH via UPDATE direto com flag de sessão (rejeição 42501)
- **T05:** Tentativa de vincular a empresa de outro tenant (rejeição 23503)
- **T06:** Tentativa de retificar lote aprovado/pago (Lote 2, rejeição 55000)
- **T07:** Tentativa de retificar lote com CNAB gerado (Lote 3, rejeição 55000)
- **T08:** Tentativa de alterar horas (Fail-closed, rejeição 0A000)
- **T09:** Preservação estrita da remuneração e horas apuradas
- **T10:** Manutenção da integridade matemática dos totais do lote pai
- **T11:** Gravação de auditoria em `public.audit_log`
- **T12:** Concorrência otimista (OCC por `p_updated_at`, rejeição 40001)
- **T13:** Fechamento operacional legítimo (Lote 4, Item 3)
- **T14:** Revalidação de lote devolvido pelo RH (Lote 5)

---

## 7. CONFIRMAÇÃO FORMAL DE ISOLAMENTO

Confirmo expressamente que:
- **Nenhum comando atingiu a base de produção.**
- **Nenhum container foi inicializado nesta etapa.**
- **Nenhuma migration foi aplicada remotamente.**
- **O arquivo `.env.local` permanece inalterado.**
- **Nenhum dado real foi manipulado ou exportado.**
- **Nenhum comando Git de escrita foi executado.**

---

## 8. PRÓXIMO PASSO PROPOSTO

Aguardar autorização do proprietário do ERP para:
1. Iniciar o Docker Desktop no Windows (ou autorizar o uso do PostgreSQL 17.5 nativo como alternativa).
2. Subir o ambiente local (`npx supabase start`).
3. Carregar o seed sintético e aplicar a migration 05B.
4. Executar os 14 testes da matriz de homologação e reportar os resultados.
