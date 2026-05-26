---
trigger: always_on
---

# REGRA CRÍTICA — PRESERVAÇÃO DO QUE JÁ FUNCIONA

Antes de qualquer alteração, correção, refatoração, migration, ajuste de fluxo, alteração de tabela, alteração de status, alteração de frontend, backend, hook, service, context, trigger, edge function ou regra de negócio:

O sistema DEVE primeiro identificar e mapear o que já está funcionando corretamente.

---

# OBRIGAÇÃO ANTES DE ALTERAR QUALQUER COISA

Antes de corrigir qualquer item:

[ ] Identificar funcionalidades estáveis  
[ ] Identificar fluxos já aprovados e funcionando  
[ ] Identificar telas já operacionais  
[ ] Identificar tabelas já integradas corretamente  
[ ] Identificar dependências entre módulos  
[ ] Identificar impacto sistêmico da alteração  
[ ] Identificar arquivos compartilhados  
[ ] Identificar services/hooks/contextos reutilizados  
[ ] Identificar funções utilizadas em múltiplos fluxos  
[ ] Identificar possíveis efeitos colaterais  

---

# REGRA DE OURO DO ERP ORBE

NENHUMA correção pode quebrar:

- Fluxos já validados
- Processamentos já funcionais
- Dashboards já corretos
- Relatórios já corretos
- Integrações já operacionais
- Cálculos já aprovados
- Status já utilizados em produção de teste
- Regras financeiras já funcionando
- Geração de pagamento/CNAB já funcional

---

# ANTES DE CADA CORREÇÃO

Executar obrigatoriamente:

## 1. Diagnóstico

Responder:

- O que está quebrado?
- O que já funciona?
- O que depende disso?
- O que pode ser impactado?

---

## 2. Mapeamento de impacto

Listar:

- Arquivos envolvidos
- Hooks envolvidos
- Services envolvidos
- Tabelas envolvidas
- Views envolvidas
- Triggers envolvidas
- Edge Functions envolvidas
- Fluxos impactados

---

## 3. Classificação do risco

Classificar:

### Baixo risco
Correção isolada sem impacto sistêmico.

### Médio risco
Pode impactar telas ou fluxos relacionados.

### Alto risco
Pode quebrar processamento, pagamento, dashboards, RH, financeiro ou integrações.

---

## 4. Correção segura

A correção deve:

[ ] Preservar retrocompatibilidade  
[ ] Preservar estrutura existente  
[ ] Não remover colunas sem validação  
[ ] Não alterar status sem mapear uso completo  
[ ] Não alterar nomes sem rastrear referências  
[ ] Não quebrar tipagem TypeScript  
[ ] Não quebrar queries existentes  
[ ] Não quebrar relatórios  
[ ] Não quebrar dashboards  
[ ] Não quebrar permissões  
[ ] Não quebrar RLS  
[ ] Não quebrar hooks compartilhados  

---

## 5. Pós-correção obrigatório

Após cada alteração:

[ ] Revalidar fluxo original  
[ ] Revalidar fluxo relacionado  
[ ] Revalidar dashboard  
[ ] Revalidar relatório  
[ ] Revalidar logs  
[ ] Revalidar status  
[ ] Revalidar responsividade  
[ ] Revalidar console React  
[ ] Revalidar Supabase queries  
[ ] Revalidar permissões  

---

# PROIBIDO

❌ Corrigir no escuro  
❌ Refatorar sem mapear impacto  
❌ Alterar tabelas sem rastrear uso  
❌ Alterar status sem auditoria  
❌ Remover código “aparentemente inútil” sem validar dependências  
❌ Criar duplicidade de regra de negócio  
❌ Quebrar compatibilidade entre frontend e Supabase  
❌ Alterar estrutura financeira sem validação completa  

---

# PRIORIDADE MÁXIMA

O objetivo NÃO é apenas corrigir erros.

O objetivo é:

✅ Estabilizar o ERP  
✅ Blindar os fluxos  
✅ Preservar o que já funciona  
✅ Eliminar regressões  
✅ Garantir integridade operacional  
✅ Garantir segurança dos dados  
✅ Garantir continuidade do processo operacional  

---

# PRINCÍPIO FINAL

Toda alteração deve seguir:

IDENTIFICAR → MAPEAR → VALIDAR → CORRIGIR → TESTAR → DOCUMENTAR

Nunca pular etapas.