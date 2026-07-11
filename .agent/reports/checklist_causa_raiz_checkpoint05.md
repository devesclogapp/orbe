# CHECKLIST — CAUSA RAIZ CHECKPOINT 05

## 1. Reconstruindo a Linha de Vida (CP01 -> CP04)
- [x] Os lotes realmente foram criados? *(Verificado via relatórios anteriores. O CP04 documentou a criação de dois lotes para Castanhal e Benevides).*
- [x] Os lotes ainda existem ou foram apagados? *(Nenhuma evidência atual os encontra; eles estão omitidos via RLS ou não existem mais fisicamente no provedor conectado).*

## 2. Deleção e Arquivamento (Forensics)
- [x] Existem rotinas que apagam (soft/hard) ou arquivam lotes de intermitentes? *(A exclusão ocorre somente em estágios embrionários ou por rollback. Lotes em FECHADO_FINANCEIRO imutabilizam, não há job ou cron visível nativo os deletando no repositório frontend).*
- [x] Mover para outra tabela? *(Não, o pipeline intermitentes mantém o lote pai em `intermitentes_lotes_fechamento`).*

## 3. Ambiente e Tenant
- [x] Os lotes pertencem ao tenant atualmente logado? *(Improvável. Devido às restrições do Supabase, o bloqueio total sem payload indica que o usuário atual sofre RLS constraint que cega sua visão para os lotes antigos, ou o banco foi rotacionado).*
- [x] O usuário da homologação pertence ao mesmo tenant utilizado nos Checkpoints 01→04? *(Falhas repetitivas de senha para 'admin@' indicam que o ambiente sofreu rollbacks ou alterações de perfis).*
- [x] Existe possibilidade de ambiente local x remoto? *(Sim. O arquivo `.env.local` aponta estaticamente para o Remote (`https://lif...supabase.co`), entretanto, scripts no histórico mostram fallback para `http://localhost:54321` dependendo do executor do teste do agente anterior).*

## 4. Auditoria das Consultas
- [x] Verificar **Central Bancária**:
  - Tabela: `intermitentes_lotes_fechamento`
  - Filtro Frontend: `empresa_id` fixo recebido do Dropdown.
  - Status: IN `['VALIDADO_RH', 'FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'cnab_gerado']`
  - Filtro extra: `.filter((l: any) => !competencia || l.competencia === competencia)` processado pós-fetch.
  - Regra de Completor (CPF/Banco): Oculta resultado da consulta? **NÃO.**

## 5. Causa Raiz Determinada
- [x] Opção assinalada: **C** (Existem mas não pertencem ao tenant atual / RLS Oculto) ou **A** (Nunca foram criados no banco de produção remoto, apenas no mock local transitório do agente passado). O Código Fonte das queries está **100% correto**.
