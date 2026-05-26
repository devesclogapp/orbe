---
trigger: always_on
---

Você é um agente especialista em React, TypeScript, Supabase, PostgreSQL, hooks, estados assíncronos, formulários ERP e sincronização frontend/backend.

Sua missão é identificar, corrigir e blindar TODOS os problemas de inconsistência de carregamento de dados no ERP Orbe.

O principal problema observado é:

⚠️ Dados EXISTEM no banco  
⚠️ Dados FORAM salvos corretamente  
⚠️ Porém NÃO aparecem no frontend  
⚠️ Não preenchem campos automaticamente  
⚠️ Não carregam em formulários/modais  
⚠️ Não refletem nas tabelas  
⚠️ Não atualizam estados visuais  

Exemplo observado:

- Modal abre
- Dados deveriam preencher os campos
- Parte dos dados vem vazia
- Alguns campos não refletem o registro salvo
- Selects/listas não carregam valor salvo
- Campos automáticos não refletem cálculo persistido

O objetivo é eliminar COMPLETAMENTE qualquer inconsistência de sincronização entre:

Frontend ↔ Hooks ↔ Services ↔ Supabase ↔ Banco ↔ Estado React

---

# OBJETIVO PRINCIPAL

Descobrir por que os dados:

- existem
- foram salvos
- estão no banco

MAS:

- não aparecem
- não carregam
- não preenchem
- não atualizam
- não renderizam

---

# INVESTIGAÇÃO OBRIGATÓRIA

Antes de corrigir:

[ ] Identificar se o problema está no banco  
[ ] Identificar se o problema está na query  
[ ] Identificar se o problema está no select do Supabase  
[ ] Identificar se o problema está no service  
[ ] Identificar se o problema está no hook  
[ ] Identificar se o problema está no useEffect  
[ ] Identificar se o problema está no estado React  
[ ] Identificar se o problema está no formulário  
[ ] Identificar se o problema está no defaultValues  
[ ] Identificar se o problema está no reset/setValue  
[ ] Identificar se o problema está no mapeamento  
[ ] Identificar se o problema está no nome da propriedade  
[ ] Identificar se o problema está na tipagem  
[ ] Identificar se o problema está em relacionamento SQL  
[ ] Identificar se o problema está em join/foreign key  
[ ] Identificar se o problema está em race condition  
[ ] Identificar se o problema está em loading assíncrono  
[ ] Identificar se o problema está em cache  
[ ] Identificar se o problema está em estado stale  
[ ] Identificar se o problema está em renderização condicional  

---

# VALIDAR TODOS OS TIPOS DE INCONSISTÊNCIA

---

# 1. CAMPOS NÃO PREENCHENDO

Validar:

[ ] Campo existe no banco  
[ ] Campo vem na query  
[ ] Campo chega no frontend  
[ ] Campo chega no modal  
[ ] Campo chega no formulário  
[ ] Campo recebe setValue/reset  
[ ] Campo renderiza  
[ ] Campo não está undefined  
[ ] Campo não está null indevidamente  
[ ] Campo não possui nome divergente  
[ ] Campo não possui typo  
[ ] Campo não possui snake_case/camelCase divergente  

---

# 2. SELECTS/LISTAS NÃO CARREGANDO

Validar:

[ ] Lista busca corretamente  
[ ] Query retorna itens  
[ ] Dados chegam no componente  
[ ] Value corresponde ao option  
[ ] Label corresponde corretamente  
[ ] ID salvo existe na lista  
[ ] Foreign key válida  
[ ] Lista carrega antes do formulário renderizar  
[ ] Estado não está vazio por race condition  
[ ] Async await correto  
[ ] Loading correto  
[ ] useEffect correto  

---

# 3. DADOS SALVOS MAS NÃO EXIBIDOS

Validar:

[ ] Registro realmente salvo  
[ ] Query correta  
[ ] Select inclui campo  
[ ] Relacionamento correto  
[ ] Hook atualiza estado  
[ ] invalidateQueries funcionando  
[ ] React Query/TanStack Query invalidando cache  
[ ] Estado local atualizado  
[ ] Re-render acontecendo  
[ ] Dependências do useEffect corretas  
[ ] Não existe stale state  
[ ] Não existe memoização quebrando atualização  

---

# 4. MODAIS NÃO CARREGANDO DADOS

Validar:

[ ] Modal recebe props corretamente  
[ ] Dados chegam antes do open  
[ ] reset() executa corretamente  
[ ] setValue() executa corretamente  
[ ] defaultValues corretos  
[ ] FormProvider correto  
[ ] React Hook Form sincronizado  
[ ] Campos controlados corretamente  
[ ] Inputs não estão uncontrolled indevidamente  

---

# 5. TABELAS NÃO REFLETINDO DADOS

Validar:

[ ] Query da tabela correta  
[ ] Campos retornados corretos  
[ ] Paginação correta  
[ ] Filtros corretos  
[ ] Cache invalidado após save  
[ ] Atualização otimista correta  
[ ] Re-fetch funcionando  
[ ] Dados formatados corretamente  

---

# 6. CAMPOS AUTOMÁTICOS NÃO ATUALIZANDO

Exemplo:

- modalidade resultante
- valor automático
- vencimento
- cálculo operacional
- valor descarga
- valor total

Validar:

[ ] Dependências corretas  
[ ] useMemo correto  
[ ] useEffect correto  
[ ] Recalcula após alteração  
[ ] Estado sincronizado  
[ ] Backend e frontend usam mesma regra  
[ ] Regras operacionais carregam corretamente  
[ ] Dados derivados persistem corretamente  

---

# 7. RELACIONAMENTOS NÃO EXIBIDOS

Validar:

[ ] Empresa carrega unidades  
[ ] Unidade carrega locais  
[ ] Colaborador carrega categoria  
[ ] Operação carrega regra operacional  
[ ] FK existe  
[ ] FK válida  
[ ] Join correto  
[ ] Select nested correto  
[ ] Alias correto  
[ ] Dados não estão órfãos  

---

# 8. ERROS SILENCIOSOS

Identificar:

[ ] try/catch engolindo erro  
[ ] console.error ausente  
[ ] erro ignorado  
[ ] fallback escondendo problema  
[ ] loading infinito  
[ ] estado vazio silencioso  
[ ] null propagation  
[ ] optional chaining escondendo inconsistência  

---

# 9. VALIDAR TODAS AS TELAS CRÍTICAS

Executar auditoria milimétrica em:

- lançamentos operacionais
- edição operacional
- regras operacionais
- diaristas
- serviços extras
- custos extras
- financeiro
- RH
- fechamento
- dashboards
- relatórios
- ciclos
- colaboradores
- empresas
- unidades
- locais
- importação de ponto
- CNAB
- pagamentos

---

# 10. VERIFICAR PADRONIZAÇÃO DE DADOS

Identificar divergências:

[ ] snake_case vs camelCase  
[ ] id vs uuid  
[ ] numero vs string  
[ ] boolean vs string  
[ ] status divergentes  
[ ] datas divergentes  
[ ] enums divergentes  
[ ] tipagem TypeScript divergente do banco  

---

# 11. VALIDAR FLUXO ASSÍNCRONO

Verificar:

[ ] ordem de carregamento  
[ ] dependência entre queries  
[ ] race conditions  
[ ] loading encadeado  
[ ] estados intermediários  
[ ] render antes da query terminar  
[ ] hooks executando fora da ordem  

---

# 12. CORREÇÕES OBRIGATÓRIAS

As correções devem:

[ ] preservar o que já funciona  
[ ] não quebrar outras telas  
[ ] não quebrar RH  
[ ] não quebrar financeiro  
[ ] não quebrar dashboards  
[ ] não quebrar relatórios  
[ ] não quebrar logs  
[ ] manter retrocompatibilidade  
[ ] padronizar carregamento de dados  

---

# 13. RESULTADO ESPERADO

Ao final:

✅ Todo dado salvo aparece  
✅ Todo campo preenche corretamente  
✅ Todo select carrega corretamente  
✅ Todo modal carrega corretamente  
✅ Toda tabela atualiza corretamente  
✅ Todo cálculo aparece corretamente  
✅ Todo relacionamento aparece corretamente  
✅ Frontend e banco ficam sincronizados  
✅ Nenhum dado “desaparece” visualmente  
✅ Nenhum campo fica vazio indevidamente  

---

# 14. FORMATO DA ENTREGA

Para cada problema encontrado:

## Tela

## Campo/componente afetado

## Sintoma

## Causa provável

## Arquivos envolvidos

## Hooks envolvidos

## Queries envolvidas

## Tabelas envolvidas

## Impacto sistêmico

## Correção recomendada

## Como validar depois

---

# 15. REGRA FINAL

NÃO corrigir superficialmente.

O objetivo NÃO é “fazer aparecer”.

O objetivo é:

- estabilizar sincronização
- blindar persistência
- eliminar inconsistências
- garantir integridade visual e operacional

Executar agora auditoria profunda de sincronização de dados do ERP Orbe.