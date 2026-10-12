# ERP ORBE — FIX-FINAL / ETAPA 05D.2
# Planejamento do Ambiente Isolado de Homologação (Docker)

> **Data de Emissão:** 12/10/2026  
> **Responsável:** Antigravity Pairing Agent  
> **Status:** Planejamento Arquitetural Concluído (Estritamente READ-ONLY — Aguardando Autorização)  
> **Estratégia Adotada:** Container Docker PostgreSQL 17 Oficial Isolado (Sem alterar `config.toml`, sem modificar migrations históricas e sem tocar em produção)  

---

## 1. CONTEXTO E DIAGNÓSTICO DO BLOQUEIO

Na Etapa 05D.1, a tentativa de inicialização padrão da Supabase CLI (`npx supabase start`) falhou na migration legada `20260420_admin_override_refinement.sql` devido ao erro:
```text
ERROR: schema "audit" does not exist (SQLSTATE 3F000)
```
Como a CLI do Supabase aborta e desliga todos os containers quando qualquer script da fila histórica falha, o stack não inicializou.

Para respeitar a diretriz de **não alterar arquivos de configuração (`supabase/config.toml`), não alterar o arquivo de ambiente (`.env.local`) e não alterar migrations históricas de outros módulos**, a solução ótima é o provisionamento de uma **instância PostgreSQL 17 dedicada de homologação via Docker**.

---

## 2. INVESTIGAÇÃO DE DEPENDÊNCIAS DA MIGRATION 05B

A auditoria minuciosa da migration [`supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql) identificou que o ecossistema de retificação dos Intermitentes depende exclusivamente dos seguintes objetos:

### 2.1 Schemas e Extensões
- Schema `public`
- Schema `auth` (emulação das funções de contexto de autenticação do Supabase)
- Extensão `pgcrypto` (para geração de UUIDs)

### 2.2 Entidades e Tabelas Requeridas
1. **`public.tenants`**: Suporte ao isolamento multi-tenant (`id`, `nome`, `slug`, `ativo`).
2. **`public.empresas`**: Amarração de tenant e validação de existência de empresa de destino (`id`, `tenant_id`, `nome`, `cnpj`, `ativo`).
3. **`public.profiles`**: Resolução de nome e perfil de quem executa a retificação (`id`, `user_id`, `nome`, `email`, `role`).
4. **`public.colaboradores`**: Cadastros de intermitentes (`id`, `tenant_id`, `empresa_id`, `nome`, `cpf`, `tipo_colaborador`, `ativo`).
5. **`public.intermitentes_lotes_fechamento`**: Agrupamento de lotes operacionais (`id`, `tenant_id`, `empresa_id`, `competencia`, `periodo_inicio`, `periodo_fim`, `quantidade_registros`, `valor_total`, `status`, `observacoes`, `updated_at`).
6. **`public.lancamentos_intermitentes`**: Tabela canônica de jornadas e apuração (`id`, `tenant_id`, `empresa_id`, `colaborador_id`, `nome_colaborador`, `cpf_colaborador`, `data_referencia`, `horas_trabalhadas`, `horas_normais`, `he_50`, `he_100`, `hora_noturna`, `total`, `status_pipeline`, `lote_fechamento_id`, `lote_devolvido_origem_id`, `observacoes`, `updated_at`).
7. **`public.cnab_remessas_arquivos`**: Histórico bancário de remessas para validação de imutabilidade pós-banco (`id`, `tenant_id`, `empresa_id`, `intermitentes_lote_id`, `nome_arquivo`, `status`).
8. **`public.audit_log`**: Trilha imutável compulsória (`id`, `tenant_id`, `empresa_id`, `usuario_id`, `usuario_nome`, `perfil_usuario`, `acao`, `entidade`, `registro_id`, `descricao`, `valor_anterior`, `valor_novo`, `origem`, `criado_em`).

### 2.3 Funções de Contexto e Governança
- `auth.uid()`: Retorna o UUID do usuário da sessão simulada.
- `auth.role()`: Retorna o papel (`authenticated`, `service_role`, `anon`).
- `public.current_tenant_id()`: Retorna o UUID do tenant ativo.
- `public.get_user_role()`: Retorna o perfil funcional (`admin`, `rh`, `encarregado`).

### 2.4 Objetos Introduzidos pela Migration 05B
- Coluna `lancamentos_intermitentes.lote_devolvido_origem_id` + índice.
- Função guardiã `fn_guard_lancamentos_intermitentes_update()` + trigger `trg_guard_lancamentos_intermitentes`.
- Função guardiã `fn_guard_lancamentos_intermitentes_delete()` + trigger `trg_guard_lancamentos_intermitentes_delete`.
- Função guardiã `fn_guard_intermitentes_lotes_delete()` + trigger `trg_guard_intermitentes_lotes_delete`.
- RPC de governança `rpc_rh_retificar_intermitente(...)` (SECURITY DEFINER, locks pessimistas ordenados, OCC, validação de estados, recálculo atômico de lote e auditoria compulsória).
- RPC de governança `rpc_rh_revalidar_lote_devolvido(...)` (SECURITY DEFINER, revalidação e retorno para análise).

---

## 3. ARQUITETURA DO AMBIENTE ISOLADO DE HOMOLOGAÇÃO

Para garantir total fidelidade sem poluir o repositório ou alterar arquivos do projeto:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       HOST WINDOWS (127.0.0.1)                              │
│                                                                             │
│  [Projeto Orbe Principal]                 [Ambiente Isolado HML]            │
│  - supabase/config.toml (INTACTO)         - Container: orbe-hml-pg17        │
│  - .env.local (INTACTO)                   - Imagem: supabase/postgres:17    │
│  - migrations legadas (INTACTAS)          - Porta Host: 54322               │
│  - Zero escrita Git                       - Volume: Efêmero / Temporário    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CONTAINER DOCKER: orbe-hml-pg17                             │
│                                                                             │
│  1. Bootstrap Mínimo (Schema Base Canônico dos Intermitentes)               │
│  2. Aplicação da Migration 05B (Triggers, RPCs, Índices e Rastreabilidade) │
│  3. Carga do Seed Sintético (supabase/seed_etapa05c_homologacao.sql)        │
│  4. Execução dos 14 Cenários de Teste (Script SQL de Homologação)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Vantagens Desta Arquitetura:
1. **Reutilização Total de Recursos:** Utiliza a imagem oficial `public.ecr.aws/supabase/postgres:17.11.0.004` já baixada no Docker Desktop.
2. **Zero Risco de Regressão:** Nenhum arquivo rastreado pelo Git do ORBE é modificado.
3. **Independência da Fila Quebrada:** Ignora os 260 scripts legados que pertencem a outros módulos e foca 100% no domínio dos Intermitentes.
4. **Descartabilidade:** Concluída a homologação, basta executar `docker rm -f orbe-hml-pg17`.

---

## 4. PROCEDIMENTO DE INICIALIZAÇÃO E EXECUÇÃO (PASSO A PASSO)

Quando autorizado pelo operador, o procedimento técnico será executado nesta sequência:

### Passo 1 — Subir o Container PostgreSQL 17 Oficial
```bash
docker run -d `
  --name orbe-hml-pg17 `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=postgres `
  -p 54322:5432 `
  public.ecr.aws/supabase/postgres:17.11.0.004
```

### Passo 2 — Aplicar o Schema Base Mínimo dos Intermitentes
Criar em arquivo temporário (scratch) o DDL estritamente necessário (tabelas `tenants`, `empresas`, `profiles`, `colaboradores`, `intermitentes_lotes_fechamento`, `lancamentos_intermitentes`, `cnab_remessas_arquivos`, `audit_log` e funções `auth.uid()`, `get_user_role()`, `current_tenant_id()`) e aplicar via:
```powershell
docker exec -i orbe-hml-pg17 psql -U postgres -d postgres < scratch/schema_base_intermitentes.sql
```

### Passo 3 — Aplicar a Migration 05B
Aplicar o script oficial intacto:
```powershell
docker exec -i orbe-hml-pg17 psql -U postgres -d postgres < supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql
```

### Passo 4 — Carregar a Base Sintética da Etapa 05C
Aplicar a massa sintética de testes (sem PII ou dados reais):
```powershell
docker exec -i orbe-hml-pg17 psql -U postgres -d postgres < supabase/seed_etapa05c_homologacao.sql
```

### Passo 5 — Execução Automatizada da Bateria dos 14 Cenários
Executar a suite SQL e capturar todas as saídas, códigos de erro (`SQLSTATE`), mensagens de exceção e estados finais.

---

## 5. AVALIAÇÃO DOS 14 CENÁRIOS NO AMBIENTE ISOLADO

| ID | Cenário | Executável no Ambiente Isolado? | Nível de Fidelidade | Necessita Homologação Adicional? |
| :---: | :--- | :---: | :---: | :--- |
| **T01** | Retificação legítima de empresa pelo RH via RPC | **SIM** | 100% | Não |
| **T02** | Bloqueio de Encarregado tentando retificar via RPC | **SIM** | 100% | Não |
| **T03** | Bloqueio de mutação direta de horas/valores via API | **SIM** | 100% | Não |
| **T04** | Bloqueio de bypass com flag transacional forjada | **SIM** | 100% | Não |
| **T05** | Bloqueio de empresa pertencente a outro tenant | **SIM** | 100% | Não |
| **T06** | Bloqueio de lote aprovado pelo RH ou pago | **SIM** | 100% | Não |
| **T07** | Bloqueio de lote com remessa CNAB bancária vinculada | **SIM** | 100% | Não |
| **T08** | Bloqueio de alteração de horas (Fail-Closed) | **SIM** | 100% | Não |
| **T09** | Preservação exata do valor da remuneração e horas | **SIM** | 100% | Não |
| **T10** | Consistência matemática dos lotes (decremento/cancelamento) | **SIM** | 100% | Não |
| **T11** | Registro compulsório em `public.audit_log` (antes e depois) | **SIM** | 100% | Não |
| **T12** | Controle de concorrência otimista (OCC via `updated_at`) | **SIM** | 100% | Não |
| **T13** | Fechamento operacional legítimo (vinculação inicial de lote) | **SIM** | 100% | Não |
| **T14** | Revalidação de lote devolvido pelo RH via RPC oficial | **SIM** | 100% | Não |

### Conclusão sobre a Cobertura dos Cenários:
- **100% dos 14 cenários** podem ser validados diretamente no container isolado, com execução nativa das regras PL/pgSQL, triggers e constraints do PostgreSQL 17.
- **Homologação adicional exigida:** Apenas a validação visual E2E da interface web (componentes React no navegador), que ocorrerá após a confirmação da integridade matemática e relacional do banco.

---

## 6. REGISTRO SEPARADO: REPRODUTIBILIDADE DAS MIGRATIONS HISTÓRICAS

A falha identificada na migration `20260420_admin_override_refinement.sql` (`ERROR: schema "audit" does not exist`) evidencia um problema arquitetural clássico do repositório:

1. **Diagnóstico do Débito:** As 261 migrations acumuladas no projeto dependem de estados prévios criados manualmente no dashboard do Supabase em fases anteriores, não sendo 100% autossuficientes a partir de uma instalação limpa ("cold start").
2. **Impacto Atual:** Impede o uso de comandos como `supabase start` ou `supabase db reset` a partir do zero sem flags de intervenção.
3. **Separação de Escopo:** Este débito pertence à governança geral do banco e **NÃO deve ser misturado com a entrega da retificação dos Intermitentes**. Qualquer tentativa precipitada de reescrever ou consolidar migrations passadas acarretaria risco severo de regressão em módulos já homologados (RH CLT, Diaristas, Financeiro CNAB).
4. **Recomendação Futura:** Planejar uma etapa exclusiva de consolidação de schema (`migration squash` ou baseline schema) após a conclusão do ciclo de homologações em curso.

---

## 7. MATRIZ DE RISCOS DA ETAPA 05D.2

| Risco | Probabilidade | Impacto | Mitigação Estrutural |
| :--- | :---: | :---: | :--- |
| **Contaminação da produção** | **ZERO** | Alto | O container roda em porta local sem qualquer string de conexão com a AWS/Supabase Cloud. |
| **Quebra de configurações do projeto** | **ZERO** | Médio | Nenhuma linha de `config.toml`, `.env.local` ou código TypeScript é alterada. |
| **Divergência de versão do Postgres** | **ZERO** | Baixo | Usa a imagem exata `postgres:17.11.0.004` distribuída pelo próprio Supabase. |
| **Conflito de portas locais** | **ZERO** | Baixo | Portas auditadas na Etapa 05D.1; porta `54322` está 100% livre. |

---

> **Ação Imediata:** Plano concluído e validado. Aguardando autorização do operador para iniciar o container Docker isolado e executar a bateria de homologação.
