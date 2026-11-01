# ORBE — SEC-03 | RELATÓRIO DE HOMOLOGAÇÃO LOCAL: FASE 02.2

**Data:** 01/11/2026  
**Módulo:** Governança e Autenticação (SEC-03: Convite Manual Simplificado & Ativação em 3 Passos)  
**Ambiente:** Local Isolado (PostgreSQL 17.11 + Vite + Docker Containers Locais)  
**Status da Fase 02.2:** HOMOLOGADA EM AMBIENTE ISOLADO (14/14 PASS E2E | 20/20 PASS REGRESSÃO)  
**Parecer:** GO PARA HOMOLOGAÇÃO INTEGRADA (Não promovido para produção)

---

## 1. RESUMO EXECUTIVO

A implementação da **Fase 02.2** concluiu com sucesso a transição para o fluxo 100% manual e simplificado de onboarding corporativo do ERP ORBE. Toda e qualquer dependência de serviços externos de mensageria (APIs de WhatsApp, links `wa.me`, serviços de e-mail e webhooks de disparo) foi eliminada da plataforma.

O fluxo de ativação passa a operar exclusivamente mediante o botão **"Copiar convite"**, que formata e copia as instruções de acesso para a Área de Transferência do Administrador. No lado do colaborador convidado, a interface foi completamente reestruturada em **3 passos progressivos**, com validação de código de 6 dígitos (OTP), proteção contra força bruta e exigência de senha de alta entropia ($\ge 12$ caracteres).

O segredo de assinatura HMAC-SHA-256 permanece **estritamente confinado ao backend** (`private.sec03_settings` no PostgreSQL e runtime de Edge Functions), garantindo que nenhum segredo seja exposto aos navegadores dos clientes.

---

## 2. ETAPAS IMPLEMENTADAS

### Etapa 1: Modal Administrativo de Geração e Cópia do Convite
* **Arquivo modificado:** `src/pages/Governanca/Usuarios.tsx`
* **Implementação:**
  * Integração com a RPC segura `admin_create_invitation_with_activation_code` (6 parâmetros, sem segredo exposto no client).
  * Modal de resultado com exibição em destaque do **Código de Ativação** (badge monoespaçado `000 000`), link de cadastro e contador de validade (10 minutos).
  * **Botão Primário `"Copiar convite"`:** Copia mensagem completa contendo saudação personalizada, razão social oficial da empresa, link direto, código de ativação e alerta de expiração.
  * Botões auxiliares: `"Copiar código"` e `"Copiar link"`.
  * **Remoção total de integrações:** Função `openWhatsAppShare` e botões de WhatsApp foram 100% extirpados do componente.

### Etapa 2: Reemissão de Códigos para Convites Pendentes
* **Arquivo modificado:** `src/pages/Governanca/Usuarios.tsx`
* **Implementação:**
  * Nova ação na tabela de usuários para convites pendentes: botão `"Novo código"` com ícone `KeyRound`.
  * Invocação da RPC `admin_issue_new_activation_code`.
  * Respeito estrito ao cooldown persistente de 60 segundos com mensagem explicativa ao Administrador.
  * Ao concluir, abre o modal de resultado com o novo código e a mensagem formatada para cópia imediata.

### Etapa 3: Tela de Ativação do Convidado em Três Passos
* **Arquivo reestruturado:** `src/pages/Auth/Cadastro.tsx`
* **Arquitetura dos 3 Passos:**
  1. **Passo 1 (Identificação):** Consome `validate_invitation_token(token)` e exibe a Razão Social oficial (`tenant_name`), nome do colaborador, e-mail cadastrado e cargo atribuído. Bloqueia acessos sem token ou com tokens expirados/revogados.
  2. **Passo 2 (Código de Ativação):** Input numérico de 6 dígitos monoespaçado. Validação segura via RPC `sec03_verify_invitation_activation_code(token, code)`. Exibe feedback visual de tentativas restantes (máximo 5), bloqueio por excesso e expiração de 10 minutos. Ao validar, promove o desafio para `verificado` e avança para o próximo passo.
  3. **Passo 3 (Senha Forte & Ativação):** Exigência estrita de senha com no mínimo 12 caracteres, medidor de força (maiúsculas, minúsculas, números e caracteres especiais) e confirmação idêntica. Botão de ativação definitivo.

### Etapa 4: Integração Segura com Supabase Auth e Aceite do Convite
* **Arquivos envolvidos:**
  * `supabase/functions/sec03-activate-account/index.ts`
  * `supabase/migrations/20261101100000_sec_03_fase2_2_convite_simplificado_local.sql`
* **Implementação:**
  * Provisionamento idempotente no Supabase Auth: cria novo usuário ou atualiza identidade interrompida, sem duplicidades.
  * Proteção contra usurpação de tenant: impede que um usuário pertencente a outro tenant ativo seja absorvido por convite de outra organização.
  * Consumo definitivo do desafio temporário (`status = 'consumido'`).
  * Conclusão do convite (`status = 'aceito'`) e vinculação à tabela `profiles` e `user_permissions`.
  * Redirecionamento especializado: colaboradores com perfil `encarregado` são encaminhados para `/login/operacional`, mantendo seu isolamento do painel administrativo.
  * Proteção anti-bypass: `accept_tenant_invitation` rejeita categoricamente qualquer tentativa de ativação sem desafio no estado `verificado` há menos de 15 minutos.

### Etapa 5: Homologação Funcional Ponta a Ponta em Ambiente Isolado
* **Script executado:** `scratch/test_sec03_fase2_2_e2e_homologacao.mjs`
* **Resultado:** 14/14 cenários aprovados (100% PASS).
* **Regressão:** Executada a suíte `test_sec03_fase2_1_1_suite_completa.mjs` (20/20 PASS) e a suíte `test_sec02_admin_homologation.mjs` (15/15 PASS).

---

## 3. MATRIZ DE TESTES E EVIDÊNCIAS DE HOMOLOGAÇÃO E2E

| ID | Cenário de Teste | Comportamento Esperado | Resultado Obtido | Status |
|:---:|---|---|---|:---:|
| **01** | Geração Administrativa do Convite | Overload de 6 parâmetros sem segredo HMAC no client; gera código de 6 dígitos e link | Código gerado (ex: `700662`), token persistido, mensagem estruturada | **PASS** |
| **02** | Estrutura da Mensagem para "Copiar Convite" | Mensagem contém saudação, razão social, código, link `/cadastro?token=...` e prazo de 10 min | Todos os campos oficiais presentes, zero menções a WhatsApp | **PASS** |
| **03** | Reemissão com Cooldown Ativo | Bloqueio preventivo se solicitado antes de 60 segundos | Rejeição: *"Aguarde X segundos antes de gerar um novo código"* | **PASS** |
| **04** | Reemissão de Código após Cooldown | Novo código gerado, código anterior cancelado com `cancelado_reenvio` | Novo código emitido; desafio anterior marcado como `cancelado_reenvio` | **PASS** |
| **05** | Passo 1: Leitura de Metadados Oficiais | Validação do token retorna nome oficial da empresa (`tenants.nome`), e-mail e cargo | Empresa: *"Empresa Alpha Logística"*, E-mail: *"carlos@alpha.test"*, Cargo: *"rh"* | **PASS** |
| **06** | Passo 2: Código Incorreto | Retorno `INVALID_CODE` e decremento de tentativas restantes (4 restantes) | Retorna `INVALID_CODE`, `remaining_attempts: 4`, `blocked: false` | **PASS** |
| **07** | Passo 2: Bloqueio após 5 Falhas | 5ª tentativa bloqueia o código; 6ª tentativa retorna `MAX_ATTEMPTS_EXCEEDED` | 5ª tentativa: `blocked: true`, `remaining: 0`; 6ª: `MAX_ATTEMPTS_EXCEEDED` | **PASS** |
| **08** | Passo 2: Validação com Código Correto | Sucesso, status do desafio promovido a `verificado` com `verified_at = NOW()` | `verified: true`, `success: true` | **PASS** |
| **09** | Proteção Anti-Bypass | Bloqueio de chamada direta a `accept_tenant_invitation` sem código verificado | Bloqueado: *"A ativação requer a validação prévia do código de ativação"* | **PASS** |
| **10** | Passo 3: Ativação com Senha Forte | Criação de perfil no Tenant A, sincronização de permissões e desafio consumido | Profile ID gerado, tenant isolado, `invite_status: aceito`, `challenge: consumido` | **PASS** |
| **11** | Imutabilidade Pós-Ativação | Token aceito não pode ser reutilizado para nova ativação | Rejeição: *"Convite inválido, bloqueado ou expirado"* | **PASS** |
| **12** | Preservação de Encarregados | Papel `encarregado` preservado para direcionamento ao portal operacional | Cargo `encarregado` validado e rota `/login/operacional` vinculada | **PASS** |
| **13** | Isolamento de Tenants | Usuário preexistente de outro tenant não pode ser usurpado por convite de terceiro | Rejeição: *"Este usuário já possui vínculo com outra empresa."* | **PASS** |
| **14** | Preservação de Dados Reais | Zero mutações em tenants ou registros não-sintéticos em produção/desenvolvimento | Contagem de tenants de produção permaneceu 100% inalterada | **PASS** |

---

## 4. FALHAS ENCONTRADAS E CORREÇÕES APLICADAS (ROOT CAUSE ANALYSIS)

### Falha 1: Nome da Coluna de Contato na Tabela `profiles`
* **Sintoma:** Ao invocar `accept_tenant_invitation`, ocorria erro SQL `column "phone" of relation "profiles" does not exist`.
* **Causa Raiz:** O schema legado da tabela `public.profiles` nomeia a coluna de telefone como `telefone`, enquanto `user_permissions` e `tenant_invitations` utilizam `phone`. A migration da Fase 02.1 tentava inserir em `profiles.phone`.
* **Correção:** Ajustada a função `accept_tenant_invitation` em `20261101100000_sec_03_fase2_2_convite_simplificado_local.sql` para mapear corretamente `telefone = COALESCE(NULLIF(invitation.phone, ''), existing_profile.telefone)`.

### Falha 2: Desempate Não-Determinístico na Busca do Desafio Mais Recente
* **Sintoma:** Em transações de teste automatizado onde múltiplos desafios eram criados no mesmo timestamp (`NOW()`), a cláusula `ORDER BY created_at DESC LIMIT 1` selecionava aleatoriamente o desafio anterior cancelado em vez do desafio ativo.
* **Causa Raiz:** No PostgreSQL, `NOW()` é congelado no início da transação. Dois registros gerados na mesma transação possuem `created_at` idêntico.
* **Correção:** Atualizada a query de busca para filtrar `status IN ('bloqueado_tentativas', 'verificado')` e ordenar deterministamente por `ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT 1`.

---

## 5. RISCOS RESIDUAIS E MITIGAÇÕES

| Risco Residual | Probabilidade | Impacto | Mitigação Implementada |
|---|:---:|:---:|---|
| **Colaborador perde o prazo de 10 min** | Média | Baixo | Administrador possui o botão "Novo código" na listagem de usuários com feedback em 1 clique. |
| **Tentativa de contorno manual via API** | Baixa | Alto | Blindagem no banco de dados via RLS e trigger: `accept_tenant_invitation` rejeita qualquer tentativa sem desafio no estado `verificado` há menos de 15 min. |
| **Vazamento do segredo HMAC** | Nula | Crítico | Segredo armazenado exclusivamente na tabela `private.sec03_settings` (schema `private` inacessível a anon/authenticated) e variáveis de ambiente de backend. |
| **Conflito de Identidade Multi-Tenant** | Baixa | Alto | Validação explícita em `accept_tenant_invitation` e na Edge Function impedindo reatribuição de usuários pertencentes a outros tenants. |

---

## 6. PARECER TÉCNICO FINAL

* [x] **GO PARA HOMOLOGAÇÃO INTEGRADA**
* [ ] **NO-GO**

**Justificativa:** Todos os 5 requisitos foram plenamente atendidos e validados por suítes E2E automatizadas em ambiente local isolado. Nenhuma dependência externa de WhatsApp ou mensageria foi mantida. Não houve qualquer aplicação em nuvem (Supabase Cloud) nem deploy, respeitando integralmente as restrições operacionais. O sistema está pronto para homologação conjunta pelo Administrador.

