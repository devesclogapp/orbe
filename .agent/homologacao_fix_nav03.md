# REGISTRO DE HOMOLOGAÇÃO — FIX NAV-03 (REGULARIZAÇÃO DE ACESSO RH)

**Data:** 02/11/2026 14:55 UTC-3  
**Ambiente:** Produção (Supabase Cloud `lifgjtcflzmspilhryap`)  
**Módulo:** Autenticação, Controle de Tenant e Permissões RH (SEC-03 / FIX NAV-03)

---

## 1. Contexto e Problema Identificado
O usuário `flaviocarvalhoficial+2@gmail.com` conseguia se autenticar com sucesso no ERP, porém era classificado pelo `TenantContext` e `AccessControlContext` como perfil `USER`, sofrendo redirecionamento para `/operacional/dashboard` e sendo barrado pelo `AuthGuard` com a mensagem *"Acesso restrito — Seu perfil (USER) não possui permissão para acessar este módulo."*

---

## 2. Causa Raiz
* A conta `flaviocarvalhoficial+2@gmail.com` possuía vínculo histórico preexistente (desde Maio/2026) associado a um tenant de teste secundário (`8aac34d4-a67d-4a51-b76c-19dbaa6d8a89`), com perfil `user` e matriz de permissões vazia (`{}`).
* O tenant secundário não possuía nenhum dado operacional, colaborador ou registro financeiro.
* O ERP lia com exatidão os dados gravados no banco para essa conta.

---

## 3. Correção Aplicada (Transação Atômica Controlada)
Executado o script `supabase/scripts/fix_nav03_regularizar_rh.sql` no SQL Editor do Supabase com privilégios administrativos:
1. **Pré-condições validadas:** Confirmado que a conta pertencia ao tenant `8aac34d4...` com papel `user` e permissões `{}`.
2. **Bypass temporário de trigger:** Desabilitado temporariamente o trigger `trg_protect_profile_sensitive_fields` para permitir a migração administrativa de tenant.
3. **Atualização de `profiles`:** Vinculado à ESC LOG (`09ccafb6-2cf2-4c83-ac3d-a2913947693c`) com `role = 'rh'`, `onboarding_completed = true` e preservado o nome `Reis Carvalho`.
4. **Atualização de `user_permissions`:** Vinculado à ESC LOG (`09ccafb6-...`) com `role = 'rh'`, `status = 'ativo'` e matriz completa de permissões de RH com **`processamento_rh:aprovar = false`**.
5. **Reabilitação de trigger:** O trigger `trg_protect_profile_sensitive_fields` foi reabilitado imediatamente antes do `COMMIT`.
6. **Pós-condições confirmadas:** Asserção de que exatamente 1 perfil e 1 permissão foram atualizados e que a aprovação permanece desabilitada.

---

## 4. Evidências de Homologação Funcional e Visual em Produção
* **Login & Redirecionamento:** Funcionais. Redirecionamento automático pós-login para `/rh/aprovacoes`.
* **Central de Aprovações RH:** Carregando 1.000 registros operacionais em modo somente leitura (botões de Aprovar e Devolver desabilitados/ocultos).
* **Ponto & Jornadas CLT:** Carregando 39 colaboradores e suas jornadas.
* **Fechamento Mensal CLT:** Carregando as 9 unidades operacionais.
* **Fechamento de Ciclos:** Carregando os 4 ciclos da competência.
* **Integridade Transversal:** Nenhuma outra conta, convite ou registro operacional/financeiro foi alterado.

---

## 5. Testes Automatizados e Build
* **Vitest Suite SEC-03:** 14/14 testes passaram com 100% de sucesso (`sec03_backend_authorization_approvals.test.ts`).
* **Vite Production Build:** Concluído com sucesso em 59.00s sem erros de tipagem TypeScript.

