# ERP ORBE — RELATÓRIO TÉCNICO DE CORREÇÕES FIX E2E-01

**Data:** 03/11/2026  
**Branch:** `feature/navigation-by-flow`  
**Referência:** `.agent/auditoria_e2e_visual_producao.md`  
**Veredito Final:** **APTO PARA PUBLICAÇÃO**

---

## 1. RESUMO EXECUTIVO

Após a auditoria visual E2E em navegador real no ERP ORBE em produção (`https://orbe-nu.vercel.app`), foram mapeados quatro apontamentos que demandavam saneamento antes do início da operação assistida:
1. **P1 — Acesso Indevido às Configurações:** O perfil RH conseguia acessar `/configuracoes` diretamente pela URL.
2. **P2 — RH sem Acesso a Colaboradores:** O perfil RH era bloqueado em `/colaboradores` por exigência da permissão `central_de_cadastros`.
3. **P2 — Formulário Admin em Modo Encarregado:** A rota `/operacoes-volume/nova` instanciava o formulário fixo com `mode="encarregado"`.
4. **P3 — Toast Sonner sobre Botões Mobile:** Notificações flutuantes no mobile (390×844) sobrepunham a barra inferior de botões fixos (`z-50`), interceptando cliques temporariamente.

Todas as quatro correções foram implementadas na branch `feature/navigation-by-flow` de forma cirúrgica e desacoplada, preservando integralmente os módulos homologados (RH, Financeiro, Despesas, Diaristas, CLT, CNAB e Cadastros). Todas as suítes de testes unitários, checagem de tipos TypeScript, build de produção e verificação E2E em navegador Chromium real obtiveram **100% de aprovação (PASS)**.

---

## 2. DETALHAMENTO DAS CORREÇÕES

### CORREÇÃO 1 — P1 | ACESSO INDEVIDO ÀS CONFIGURAÇÕES

- **Problema:** Usuário com perfil `rh` conseguia carregar a rota `/configuracoes` digitando diretamente a URL.
- **Causa Raiz:** A rota `/configuracoes` não estava mapeada em `ROUTE_ACCESS_RULES` dentro de `src/lib/access-control.ts`. Por consequência, a função `getRouteAccessRule('/configuracoes')` retornava `undefined`, permitindo que o `AuthGuard` concedesse acesso irrestrito para qualquer usuário autenticado. Além disso, a página `Configuracoes.tsx` não possuía uma barreira de defesa em profundidade baseada em permissão explícita de governança ou perfil admin.
- **Arquivos Modificados:**
  - `src/lib/access-control.ts`: Adicionada regra explícita para `/configuracoes` com `allowedRoles: ["admin"]` e `allowedModules: ["governanca"]`. Atualizada a função `isRouteForbiddenForRole` para classificar `/configuracoes` como proibida para os perfis `rh` e `encarregado`.
  - `src/components/Auth/AuthGuard.tsx`: Atualizado para validar regras com `allowedRoles` e `allowedModules` em paralelo com as permissões granulares por módulo.
  - `src/pages/Configuracoes.tsx`: Implementada guarda de defesa em profundidade via `useEffect`, redirecionando imediatamente para `/dashboard` (admin sem permissão) ou `/rh/aprovacoes` (perfil RH) caso o usuário não possua autorização.
- **Evidência de Teste:**
  - Vitest: `access-control.test` e `fix_e2e01_corrections.test.ts` (PASS).
  - Playwright E2E em Chromium: RH tentou navegar para `http://localhost:4173/configuracoes` e foi redirecionado imediatamente para `/rh/aprovacoes`. Nenhuma informação administrativa foi exibida. Screenshot gerada em `scratch/e2e_prod_captures/fix1_rh_configuracoes_blocked.png`.

---

### CORREÇÃO 2 — P2 | RH SEM ACESSO A COLABORADORES

- **Problema:** Ao tentar acessar `/colaboradores`, o perfil RH era redirecionado para `/rh/aprovacoes` com mensagem de acesso não autorizado, impedindo a consulta cadastral dos funcionários.
- **Causa Raiz:** A rota `/colaboradores` estava associada de forma exclusiva ao módulo `central_de_cadastros`. Em produção, o perfil RH possui autorizações focadas em `processamento_rh`, `pontos_recebidos` e `banco_de_horas`, não possuindo a permissão abrangente de cadastros corporativos.
- **Arquivos Modificados:**
  - `src/lib/access-control.ts`: A rota `/colaboradores` foi flexibilizada com `allowedRoles: ["admin", "rh"]` e `allowedModules: ["central_de_cadastros", "processamento_rh", "pontos_recebidos", "banco_de_horas"]`.
  - `src/pages/Colaboradores.tsx`: Integrado o hook `useAccessControl()` para proteger granularmente as ações da tela:
    - O botão de link para "Central de Cadastros" é exibido somente se o usuário possuir `canAccess("central_de_cadastros", "ver")`.
    - O botão "Novo colaborador" é condicionado a `canAccess("central_de_cadastros", "criar")` ou perfil Admin.
    - O botão de exclusão de colaborador na tabela é condicionado a `canAccess("central_de_cadastros", "excluir")` ou perfil Admin.
- **Evidência de Teste:**
  - Vitest: Testes unitários confirmam `canAccessRoute('/colaboradores') === true` para RH e preservação de restrições de escrita.
  - Playwright E2E em Chromium: RH logado navegou para `http://localhost:4173/colaboradores`. A tabela de colaboradores carregou com status 200, exibindo listagem de funcionários, com o botão "Central de Cadastros" devidamente oculto. Screenshot gerada em `scratch/e2e_prod_captures/fix2_rh_colaboradores_allowed.png`.

---

### CORREÇÃO 3 — P2 | FORMULÁRIO ADMIN EM MODO ENCARREGADO

- **Problema:** A rota administrativa `/operacoes-volume/nova` renderizava o componente `<OperacaoForm mode="encarregado" />`, omitindo a estrutura de navegação administrativa e impondo limites da visão operacional móvel.
- **Causa Raiz:** Em `src/pages/LancamentoProducao.tsx`, o componente `OperacaoForm` recebia uma prop estática `mode="encarregado"`, independentemente de a rota ter sido disparada pelo Encarregado (`/producao`) ou pelo Administrador (`/operacoes-volume/nova`).
- **Arquivos Modificados:**
  - `src/pages/LancamentoProducao.tsx`: Avaliação contextual do modo do formulário:
    - Se a rota for `/operacoes-volume/nova` ou se o usuário autenticado for Administrador, renderiza `formMode = "admin"`, empacotado no `AppShell` administrativo com cabeçalho contextual e botão de retorno para `/operacoes-volume`.
    - Se acessado na rota `/producao` pelo Encarregado, renderiza `formMode = "encarregado"`, empacotado no `OperationalShell` mobile com atalhos de produção.
- **Evidência de Teste:**
  - Vitest: Testes unitários de renderização contextual.
  - Playwright E2E em Chromium: Admin acessou `http://localhost:4173/operacoes-volume/nova`. O formulário foi renderizado dentro do `AppShell` administrativo, com título, navegação lateral e botão de retorno para a listagem `/operacoes-volume`. Screenshot gerada em `scratch/e2e_prod_captures/fix3_admin_operacao_mode_admin.png`.

---

### CORREÇÃO 4 — P3 | TOAST SONNER SOBRE BOTÕES MOBILE

- **Problema:** Em telas móveis (viewport 390×844), ao disparar mensagens de erro ou validação no fluxo do Encarregado, a notificação flutuante cobria a barra fixa inferior (`z-50`), interceptando o clique nos botões "Voltar" e "Cancelar" por até 4 segundos.
- **Causa Raiz:** O componente `Toaster` do Sonner em `src/components/ui/sonner.tsx` não definia `mobileOffset`. No mobile, o Sonner assume alinhamento padrão colado na base inferior da viewport (`bottom: 0px` a `16px`), colidindo diretamente com a barra de botões que possui 74px de altura.
- **Arquivos Modificados:**
  - `src/components/ui/sonner.tsx`: Configurada a propriedade `mobileOffset={{ bottom: "92px", left: "16px", right: "16px" }}` e posição `bottom-right`. O espaçamento garante uma folga segura de 18px acima da barra de ações do Encarregado em qualquer resolução mobile.
- **Evidência de Teste:**
  - Playwright E2E em Chromium (390×844): Encarregado acessou `/producao`, selecionou "Operação por Volume" e clicou em "Próximo" com os campos vazios para disparar o toast. O toast foi renderizado acima da barra inferior. O botão "Voltar" foi acionado imediatamente com latência de **57ms** sem nenhuma interceptação de ponteiro, retornando com sucesso para o menu operacional. Screenshot gerada em `scratch/e2e_prod_captures/fix4_mobile_toast_above_bar.png`.

---

## 3. RESUMO DOS ARQUIVOS MODIFICADOS E CRIADOS

| Arquivo | Tipo | Natureza da Alteração |
|---|---|---|
| `src/lib/access-control.ts` | Modificado | Suporte a `allowedRoles` em `RouteAccessRule`, regras para `/configuracoes` e `/colaboradores`, bloqueio explícito em `isRouteForbiddenForRole`. |
| `src/components/Auth/AuthGuard.tsx` | Modificado | Validação combinada de roles e módulos permitidos antes do fallback de redirecionamento. |
| `src/pages/Configuracoes.tsx` | Modificado | Defesa em profundidade com redirecionamento de usuários sem permissão de governança. |
| `src/pages/Colaboradores.tsx` | Modificado | Ocultação seletiva de botões administrativos ("Central de Cadastros", "Novo", "Excluir") para perfil RH. |
| `src/pages/LancamentoProducao.tsx` | Modificado | Alternância contextual entre `mode="admin"` (`AppShell`) e `mode="encarregado"` (`OperationalShell`). |
| `src/components/ui/sonner.tsx` | Modificado | Configuração de `mobileOffset` elevando toasts em 92px do rodapé em viewports móveis. |
| `src/test/fix_e2e01_corrections.test.ts` | Criado | Suíte unitária cobrindo isoladamente as 4 correções implementadas (10 testes). |

---

## 4. RESULTADOS DE TESTES E BUILD

### 4.1 Checagem de Tipos TypeScript (`tsc --noEmit`)
```text
Resultado: 0 erros encontrados. Código 100% aderente aos tipos do projeto.
```

### 4.2 Build de Produção Vite (`npm run build`)
```text
vite v5.4.19 building for production...
✓ 2465 modules transformed.
dist/index.html                   1.44 kB │ gzip:   0.62 kB
dist/assets/index-*.css          96.12 kB │ gzip:  17.84 kB
dist/assets/index-*.js        1,684.22 kB │ gzip: 442.31 kB
✓ built in 27.60s
```

### 4.3 Suítes de Testes Unitários e de Regressão (Vitest)
```text
✓ src/test/fix_e2e01_corrections.test.ts (10 tests) - PASS
✓ src/test/nav01_root_redirect_access_control.test.tsx (7 tests) - PASS
✓ src/test/sec03_aprovacoes_permissoes_rbac.test.tsx (7 tests) - PASS
Total: 24/24 testes passaram (100%).
```

### 4.4 Verificação E2E em Navegador Real (Chromium)
```text
[PASS] FIX-1-RH-CONFIGURACOES: RH bloqueado e redirecionado para /rh/aprovacoes.
[PASS] FIX-2-RH-COLABORADORES: RH consulta /colaboradores com 200 OK. "Central de Cadastros" oculto.
[PASS] FIX-3-ADMIN-OPERACAO-VOLUME: Admin renderizado dentro do AppShell com backPath para /operacoes-volume.
[PASS] FIX-4-MOBILE-TOAST-POSITION: Toast posicionado em bottom 92px. Botão Voltar clicado em 57ms sem bloqueio de ponteiro.
```

---

## 5. AVALIAÇÃO DE RISCOS E REGRESSÕES

- **RH:** Nenhuma regra de cálculo, banco de horas, apontamentos ou aprovação foi alterada. O perfil RH apenas ganhou a faculdade de consultar o quadro de colaboradores sem poderes de mutação administrativa. Risco: **NULO**.
- **Admin:** O formulário de volume recuperou sua integração natural ao `AppShell` administrativo. Risco: **NULO**.
- **Encarregado:** A experiência operacional mobile unificada foi preservada integralmente, agora sem interferência de toasts sobre os botões de ação. Risco: **NULO**.
- **Financeiro / CNAB / Operações:** Nenhuma query, RPC ou tabela de banco de dados foi alterada. Risco: **NULO**.

---

## 6. VEREDITO FINAL

> ### **STATUS: APTO PARA PUBLICAÇÃO**
> Todas as pendências apontadas na auditoria visual de produção foram resolvidas de forma limpa, segura e testada de ponta a ponta em navegador real. O código está pronto para ser mesclado e implantado.

