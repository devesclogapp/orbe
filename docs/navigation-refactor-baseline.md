# PONTO DE RESTAURAÇÃO E BASELINE - REORGANIZAÇÃO DA NAVEGAÇÃO

**Data:** 01 de Setembro de 2026
**Branch Original:** `main`
**SHA Inicial (Baseline):** `2ca72c8029ff970fcc0a634d12f472c536751451`
**Remote:** `origin/main` (up to date)
**Tag de Restauração:** `pre-navigation-refactor-2026-09-01`
**Branch de Desenvolvimento:** `feature/navigation-by-flow`

## Status do Build e Testes (No Baseline)
- O servidor de desenvolvimento (`npm run dev`) já se encontrava operacional na working tree.
- A suíte de testes E2E/Unitários (`npm run test --run`) identificou problemas pré-existentes na base atual: de um total de 61 testes avaliados, **52 passaram e 9 falharam**. 
  - Falhas notáveis: `src/test/intermitentes_e2e_run.test.ts` por dados insuficientes (Nenhum lançamento pendente encontrado) e `src/test/cnab_segregation.test.ts` (erros de mock/environment).
**Conclusão:** Este é exatamente o estado legado a ser preservado e documentado como _Baseline_. A reestruturação de navegação não deverá, futuramente, alterar esses dados ou os testes para forçar a aprovação.

## Inventário do Banco de Dados e Edge Functions
- **Migrations:** O repositório contém 104 arquivos SQL consolidados na pasta `supabase/migrations`. Estão contempladas nas tabelas de schema as políticas seguras Multi-tenant de RLS, e tabelas de domínio. A working tree reportou inexistência de edições nestes arquivos.
- **Edge Functions:** A estrutura comporta 12 subdiretórios independentes sob `supabase/functions/` (ex: `process-day`, `create-tenant`, integração de drivers do google, etc). Nenhuma modificação paralela local existe.

## Componentes Críticos Preservados (Intocáveis)
A reorganização garantirá integral preservação lógica das seguintes divisões (Contrato de Não-Regressão):
- Motores e Handlers em `src/services/cnab/*`
- Arquitetura central e de recursos transversais: `src/services/domain/*`, contextos lógicos como `AccessControlContext`, `TenantContext`.
- Operadores e workers: script de intermitentes e testes existentes.

## Procedimento de Rollback Recomendado

### 1. Rollback durante o Desenvolvimento Isolado
Caso seja necessário reverter ou limpar totalmente os esforços de frontend na branch de _feature_:
```bash
git switch feature/navigation-by-flow
git reset --hard pre-navigation-refactor-2026-09-01
git clean -fd
```
Isto restaura localmente todo escopo para o baseline idêntico originado neste documento.

### 2. Rollback após Fusão para Homologação/Produção (se necessário)
Caso a refatoração inteira chegue à `main` e apresente regressões intransponíveis, a abordagem determinística será reverter o commit de merge diretamente originado no pull request:
```bash
git checkout main
git revert -m 1 <sha-do-commit-de-merge>
git push origin main
```
Isso desfaz o código na ramificação mestre preservando a linha histórica limpa e sem invocar comandos perigosos como `reset --hard` via origin.

## Checkpoints Futuros
A estrutura evolutiva seguirá a tag de baseline por checkpoints progressivos homologáveis:
- **Baseline Atual:** `pre-navigation-refactor-2026-09-01`
- **Finalização da Fase 1A:** `checkpoint-navigation-1a`
- *(Fases Subsequentes receberão as tags homônimas `1b`, `2`, etc.)*

## Regra Fundamental
Conforme estabelecido pela FASE 0, não existirá adição, correção comportamental (ex. fix do test segregation de CNAB) ou remanejamento lógico atrelado à navegação que seja mascarado sob a rubrica desta feature. Toda mudança se reserva apenas a navegação, rotas e cascatas de layout (UI/UX).
    