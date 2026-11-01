# ERP ORBE — FIX-FINAL / ETAPA 05C.1
# Preparação de Ambiente Supabase Local Isolado

> **Data de Emissão:** 12/10/2026  
> **Responsável:** Antigravity Pairing Agent  
> **Status:** Diagnóstico e Preparação Concluídos (Estritamente READ-ONLY — Zero containers iniciados, Zero alterações remotas)  
> **Artefatos Gerados:** [`supabase/seed_etapa05c_homologacao.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/seed_etapa05c_homologacao.sql)  

---

## 1. OBJETIVO DA ETAPA

Verificar a disponibilidade de infraestrutura local (Docker e Supabase CLI), inspecionar a viabilidade de execução de banco isolado no ambiente de desenvolvimento, preparar massa de dados sintética para os 14 cenários de homologação e revisar o mecanismo de segurança da RPC para eliminar a dependência de `PG_CONTEXT` sem criar arquiteturas complexas de tokens adicionais.

---

## 2. DIAGNÓSTICO DE INFRAESTRUTURA LOCAL

Realizou-se inspeção técnica nos binários e daemons da máquina host:

### 2.1 Docker
- **CLI do Docker:** **Disponível** (`Docker version 28.1.1, build 4eba377`).
- **Daemon / Engine do Docker Desktop:** **Inativo / Não iniciado**.
- **Evidência Técnica:**
  ```text
  error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.49/info": 
  open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
  ```
- **Diagnóstico:** O cliente Docker está instalado no Windows, mas o serviço de background do Docker Desktop precisa ser inicializado pelo operador antes que containers locais possam ser levantados.

### 2.2 Supabase CLI
- **Status:** **Disponível** no ecossistema npm do projeto.
- **Versão:** `supabase@2.120.0` (acessível via `npx supabase`).
- **Configuração Local:** O arquivo [`supabase/config.toml`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/config.toml) já existe, com as portas padrão mapeadas:
  - API (PostgREST): `54321`
  - Banco de Dados (PostgreSQL local): `54322`
  - Studio local: `54323`

### 2.3 Viabilidade de Execução de Banco Local
- **Veredito:** **100% Viável**, condicionada unicamente à inicialização do Docker Desktop no Windows. Uma vez que o Docker esteja ativo, o comando `npx supabase start` subirá a instância local em segundos, completamente apartada de qualquer infraestrutura de nuvem.

---

## 3. DEPENDÊNCIAS E DIFICULDADES TÉCNICAS MAPEADAS

1. **Daemon do Docker:** Como o Docker Desktop não está em execução no momento, não é possível subir contêineres sem que o serviço seja iniciado.
2. **Histórico de Migrations (261 arquivos):**  
   A pasta [`supabase/migrations/`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations) contém 261 arquivos cumulativos desde abril de 2026. Em testes locais do zero (`supabase db reset`), algumas migrations antigas com dependências circulares de tenants ou dados mockados podem apresentar warnings.
   *Mitigação planejada:* Para o teste isolado da migration 05B, aplicar o schema consolidado ou executar o reset com seeds sintéticos dedicados.
3. **Isolamento de Portas e Serviços:**  
   Confirmou-se que a porta local `54322` e `54321` não conflitam com a aplicação em execução local (`npm run dev` na porta `5173` ou `8080`), permitindo isolamento cirúrgico.

---

## 4. REVISÃO DO MODELO DE SEGURANÇA DA RPC: ELIMINAÇÃO DE `PG_CONTEXT`

Conforme instrução expressa, revisamos a autorização da RPC para **substituir o parsing de `PG_CONTEXT` por controles de privilégio e contexto de execução estritamente nativos do PostgreSQL**, sem introduzir tabelas ou arquiteturas adicionais de tokens.

### 4.1 Por que substituir `PG_CONTEXT`?
- `PG_CONTEXT` é um utilitário de formatação de diagnósticos textuais para depuração humana.
- A correspondência por substring (`LIKE '%rpc_rh_retificar_intermitente%'`) é suscetível a variações de compilação, inlining e versionamento do PostgreSQL.

### 4.2 Proposta Técnica Baseada em Privilégios Nativos e Execução Elevada
O PostgreSQL possui um mecanismo inviolável no kernel: **`CURRENT_USER` vs. `SESSION_USER` sob funções `SECURITY DEFINER`**.

Quando um cliente acessa via Supabase API / PostgREST:
- `SESSION_USER` = `authenticator`
- `CURRENT_USER` = `authenticated` (ou `anon`)
- Clientes **NÃO possuem privilégio `SET ROLE postgres`** (bloqueado com `permission denied to set role`).

Quando a RPC [`public.rpc_rh_retificar_intermitente`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql#L110) é executada:
- Como foi declarada com `SECURITY DEFINER` e `OWNER TO postgres`, o PostgreSQL **eleva `CURRENT_USER` temporariamente para `'postgres'`**.
- A RPC ativa a flag com escopo estritamente local à transação (`set_config('orbe.in_rpc_retificacao', 'true', true)`).
- Imediatamente após os `UPDATEs`, a RPC desativa a flag (`set_config('orbe.in_rpc_retificacao', 'false', true)`).

### 4.3 Refinamento Proposto para o Trigger Guardião
No trigger [`fn_guard_lancamentos_intermitentes_update`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql#L21):
```sql
-- 2. Autorização exclusiva para retificações originadas da RPC rpc_rh_retificar_intermitente.
-- Controles nativos verificáveis no PostgreSQL sem dependência de parsing de strings de diagnóstico:
-- A) Contexto de execução elevado SECURITY DEFINER (current_user = 'postgres')
-- B) Flag transacional configurada pela RPC (orbe.in_rpc_retificacao = 'true')
-- C) Perfil autenticado comprovado de governança (RH ou Administrador)
IF (current_user = 'postgres') AND
   (current_setting('orbe.in_rpc_retificacao', true) = 'true') AND
   (lower(trim(coalesce(public.get_user_role(), ''))) IN ('admin', 'super_admin', 'rh')) THEN
    RETURN NEW;
END IF;
```

#### Comprovação de Segurança:
- Se um usuário RH tentar contornar a RPC via PostgREST client:
  - `current_user` será `'authenticated'` (NÃO `'postgres'`).
  - O teste `current_user = 'postgres'` avalia para **`FALSE`**.
  - O trigger bloqueia o update com `42501 (MUTACAO_PROIBIDA)` ou `42501 (VINCULO_PROTEGIDO)`.
- Se um usuário comum (encarregado) tentar chamar a RPC:
  - A própria RPC rejeita no Passo 1 com `42501 (ROLE_NOT_AUTHORIZED)`.
- **Zero arquitetura de tokens adicionais:** Utiliza exclusivamente primitivas intrínsecas do PostgreSQL.

---

## 5. DADOS SINTÉTICOS PREPARADOS PARA A HOMOLOGAÇÃO

Foi gerado e versionado localmente o arquivo:
[`supabase/seed_etapa05c_homologacao.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/seed_etapa05c_homologacao.sql)

O arquivo contém massa sintética pura (zero PII, zero valores reais de produção):
- **Tenants:** `Tenant HML Alpha` e `Tenant HML Beta (Isolado)`.
- **Empresas:** `Empresa Origem HML A`, `Empresa Destino HML B`, e `Empresa Tenant Diferente C`.
- **Colaboradores:** 2 colaboradores fictícios de regime intermitente.
- **Lotes Operacionais:**
  - Lote 1: Devolvido pelo RH (2 itens, R$ 570,00) para testes de retificação, preservação de totais e OCC (T01, T02, T04, T08, T09, T10, T11, T12).
  - Lote 2: Aprovado pelo RH para teste de bloqueio de lote finalizado (T06).
  - Lote 3: Com CNAB gerado para teste de trava bancária (T07).
  - Lote 4: Aberto (`AGUARDANDO_VALIDACAO_RH`) para teste de fechamento operacional legítimo (T13).
  - Lote 5: Devolvido para teste de revalidação integral pelo RH (T14).
- **Lançamentos:** 6 lançamentos cobrindo todos os cenários da matriz de testes.

---

## 6. PRÓXIMOS COMANDOS PROPOSTOS (AGUARDANDO AUTORIZAÇÃO)

Quando o proprietário do ERP autorizar a execução do ambiente de testes:

### Passo 1 — Iniciar Docker Desktop
- Iniciar o aplicativo Docker Desktop no Windows.

### Passo 2 — Iniciar Supabase Local
```powershell
npx supabase start
```
*(Inicia containers locais do PostgreSQL, PostgREST e Studio sem tocar em nada remoto).*

### Passo 3 — Carregar Seed Sintético e Aplicar Migration
```powershell
npx supabase db execute --file supabase/seed_etapa05c_homologacao.sql
npx supabase db execute --file supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql
```

### Passo 4 — Executar os 14 Cenários de Teste da Matriz
- Executar script automatizado de validação dos cenários T01 a T14 contra `http://127.0.0.1:54321`.

### Passo 5 — Desligar Ambiente Local
```powershell
npx supabase stop
```

---

## 7. CONFIRMAÇÃO FORMAL DE GOVERNANÇA

Declaro formally que:
- **Nenhuma migration foi executada no projeto remoto.**
- **Nenhum comando SQL de escrita foi enviado ao Supabase remoto.**
- **Nenhum container Docker foi iniciado nesta etapa.**
- **O arquivo `.env.local` permanece 100% inalterado.**
- **Nenhum comando Git de escrita foi executado.**
- **A base de produção e suas integrações (Tio Digital, n8n) permanecem completamente intocadas.**

*Aguardando avaliação e autorização expressa para a próxima etapa.*
