---
trigger: always_on
---

Você é um agente sênior especialista em React, TypeScript, Supabase, PostgreSQL, TanStack Query, sincronização de dados, ERP operacional e auditoria de inconsistência frontend/backend.

Estamos corrigindo o ERP Orbe.

O problema atual é:

Dados lançados pelo ENCARREGADO no acesso mobile/operacional estão sendo salvos no banco, mas nem todos aparecem corretamente nas telas internas do ERP Orbe.

Exemplo principal:

- Encarregado lança uma operação por volume.
- O registro é salvo.
- Ao acessar o ERP principal, na tela de recepção/lançamentos/operações por volume, a tabela deveria demonstrar todas as informações lançadas.
- Porém alguns campos aparecem vazios, zerados, incorretos ou não aparecem.
- Cada dado deveria aparecer em sua coluna correta, filtro correto, modal correto e relatório correto.

O objetivo é corrigir esse problema em TODO O APP, não apenas em uma tela.

---

# OBJETIVO DA AUDITORIA

Investigar, mapear e corrigir todas as inconsistências de demonstração de dados entre:

Portal do Encarregado → Banco Supabase → Services/Hooks → ERP Principal → Tabelas → Modais → Relatórios → Dashboards

A regra é:

Se o dado foi lançado e salvo, ele precisa aparecer corretamente em todos os lugares onde deve aparecer.

---

# REGRA DE PRESERVAÇÃO

Antes de corrigir qualquer coisa:

[ ] Identificar o que já está funcionando  
[ ] Mapear quais telas já exibem dados corretamente  
[ ] Preservar fluxos já estáveis  
[ ] Não quebrar RH  
[ ] Não quebrar financeiro  
[ ] Não quebrar dashboards  
[ ] Não quebrar relatórios  
[ ] Não quebrar CNAB  
[ ] Não quebrar logs  
[ ] Não refatorar sem necessidade  
[ ] Não alterar estrutura de dados sem mapear impacto  

---

# ESCOPO PRINCIPAL

Auditar principalmente os dados vindos dos lançamentos do encarregado:

## 1. Operação por volume

Validar se aparecem corretamente:

[ ] Empresa  
[ ] Unidade  
[ ] Local  
[ ] Data  
[ ] Tipo de operação  
[ ] Quantidade  
[ ] Quantidade de colaboradores  
[ ] Valor unitário  
[ ] Valor descarga  
[ ] Valor total  
[ ] Modalidade de pagamento  
[ ] Forma de pagamento  
[ ] Placa  
[ ] NF SIM/NÃO  
[ ] Entrada  
[ ] Saída  
[ ] Observação  
[ ] Status  
[ ] Encarregado responsável  
[ ] Criado em  
[ ] Atualizado em  

---

## 2. Diaristas

Validar se aparecem corretamente:

[ ] Colaborador  
[ ] Empresa  
[ ] Unidade  
[ ] Local  
[ ] Data  
[ ] Quantidade de diárias  
[ ] Valor da diária  
[ ] Valor total  
[ ] Função  
[ ] Status  
[ ] Observação  
[ ] Encarregado responsável  

---

## 3. Serviços extras

Validar se aparecem corretamente:

[ ] Tipo de serviço  
[ ] Descrição  
[ ] Valor  
[ ] Colaborador/fornecedor  
[ ] Empresa  
[ ] Unidade  
[ ] Local  
[ ] Data  
[ ] Status  
[ ] Observação  
[ ] Encarregado responsável  

---

## 4. Custos extras

Validar se aparecem corretamente:

[ ] Tipo de custo  
[ ] Descrição  
[ ] Valor  
[ ] Empresa  
[ ] Unidade  
[ ] Local  
[ ] Data  
[ ] Status  
[ ] Responsável  
[ ] Observação  

---

# INVESTIGAÇÃO TÉCNICA OBRIGATÓRIA

Para cada dado que não aparece, verificar:

## Banco

[ ] O dado foi salvo na tabela correta?  
[ ] O campo correto foi preenchido?  
[ ] O valor está null?  
[ ] O valor está vazio?  
[ ] O valor está salvo em JSON?  
[ ] O valor está salvo em coluna diferente?  
[ ] Existe duplicidade de tabelas para o mesmo fluxo?  
[ ] Existe tabela antiga ainda sendo usada?  
[ ] Existe tabela nova sendo usada só em parte do app?  
[ ] Existe registro órfão sem foreign key?  
[ ] Existe empresa_id/unidade_id/local_id correto?  
[ ] Existe colaborador_id correto?  
[ ] O status salvo é compatível com o filtro da tela?  

---

## Query / Service

[ ] A query busca a tabela correta?  
[ ] A query seleciona todos os campos necessários?  
[ ] Existe campo faltando no select?  
[ ] Existe join faltando?  
[ ] Existe alias errado?  
[ ] Existe filtro escondendo o registro?  
[ ] Existe filtro por status impedindo exibição?  
[ ] Existe filtro por empresa/unidade/local escondendo dados?  
[ ] Existe filtro por data/ciclo escondendo dados?  
[ ] Existe ordenação incorreta?  
[ ] Existe limite/paginação escondendo registro?  
[ ] Existe erro silencioso no service?  

---

## Hook / Estado

[ ] O hook recebe os dados corretamente?  
[ ] O hook transforma os dados corretamente?  
[ ] Existe mapeamento incompleto?  
[ ] Existe campo renomeado incorretamente?  
[ ] Existe snake_case/camelCase divergente?  
[ ] Existe stale state?  
[ ] Existe cache desatualizado?  
[ ] Existe queryKey incorreta?  
[ ] invalidateQueries está funcionando?  
[ ] refetch acontece após lançamento/edição?  
[ ] useEffect tem dependências corretas?  

---

## Frontend / Tabela

[ ] A coluna aponta para o campo correto?  
[ ] O accessorKey está correto?  
[ ] O renderCell usa o campo correto?  
[ ] Existe fallback escondendo erro?  
[ ] Existe formatação transformando valor válido em vazio?  
[ ] Valor 0 está sendo tratado como vazio indevidamente?  
[ ] Boolean false está sendo tratado como vazio indevidamente?  
[ ] Data está sendo formatada corretamente?  
[ ] Valor monetário está sendo formatado corretamente?  
[ ] Enum/status está sendo traduzido corretamente?  
[ ] Campos aninhados estão sendo acessados corretamente?  

---

# ERROS SUTIS QUE DEVEM SER PROCURADOS

Procurar especificamente por:

[ ] Campo salvo como `forma_pagamento`, mas exibido como `payment_method`  
[ ] Campo salvo como `valor_descarga`, mas tabela lendo `valor_total`  
[ ] Campo salvo como número, mas frontend esperando string  
[ ] Campo salvo como boolean, mas frontend esperando SIM/NÃO  
[ ] Campo salvo em JSON, mas frontend buscando coluna direta  
[ ] Campo salvo em `metadata`, mas tabela não extrai  
[ ] Campo salvo em tabela de origem, mas ERP lê tabela consolidada  
[ ] Status salvo como `lancado`, mas tela filtra `AGUARDANDO_RH`  
[ ] Data salva em UTC e filtro local não encontra  
[ ] Registro salvo sem `empresa_id`, ficando invisível por filtro  
[ ] Registro salvo sem `ciclo_id`, ficando fora do fechamento  
[ ] Registro salvo com unidade/local sem relacionamento  
[ ] Query com `.eq()` rígido demais  
[ ] Filtro padrão escondendo dados recentes  
[ ] RLS impedindo leitura no ERP principal  
[ ] TanStack Query usando cache antigo  
[ ] Modal/tabela usando tipo antigo  
[ ] Mapper removendo campos desconhecidos  
[ ] Optional chaining escondendo erro real  
[ ] Fallback `"-"` mascarando dado ausente  

---

# VALIDAÇÃO POR TELA

Auditar todas as telas que exibem dados lançados:

[ ] Recepção operacional  
[ ] Operações por volume  
[ ] Diaristas  
[ ] Serviços extras  
[ ] Custos extras  
[ ] RH / pendências  
[ ] Financeiro / aprovação  
[ ] Fechamento  
[ ] Relatórios  
[ ] Dashboards  
[ ] Histórico/logs  
[ ] Modais de edição  
[ ] Modais de visualização  

Para cada tela:

[ ] Registro lançado pelo encarregado aparece?  
[ ] Todos os campos aparecem?  
[ ] Campos aparecem na coluna correta?  
[ ] Filtros encontram o registro?  
[ ] Modal carrega todos os dados?  
[ ] Edição preserva todos os dados?  
[ ] Após salvar, tabela atualiza?  
[ ] Após reload, dados continuam visíveis?  

---

# TESTE REAL OBRIGATÓRIO

Criar ou usar um registro de teste lançado pelo encarregado contendo todos os campos preenchidos:

## Operação por volume teste

Preencher:

- empresa
- unidade
- local
- quantidade
- quantidade de colaboradores
- placa
- NF SIM
- entrada
- saída
- forma de pagamento
- modalidade
- observação
- valor unitário
- valor descarga
- status

Depois validar:

[ ] Aparece no ERP principal  
[ ] Aparece na tabela correta  
[ ] Aparece com todos os campos  
[ ] Aparece no modal de edição  
[ ] Aparece no RH  
[ ] Aparece no financeiro quando aprovado  
[ ] Aparece nos relatórios  
[ ] Aparece nos logs  

---

# CLASSIFICAÇÃO DOS PROBLEMAS

Classificar cada problema como:

## Básico

Erro simples de campo, label, coluna, accessor, formatação ou fallback.

## Regular

Erro de mapeamento, hook, service ou query incompleta.

## Mediano

Erro de relacionamento, cache, filtro, status ou inconsistência entre telas.

## Crítico

Erro que impede leitura, aprovação, pagamento, RH, financeiro, relatório, dashboard ou integridade dos dados.

---

# FORMATO DA ENTREGA

Para cada inconsistência encontrada, entregar:

## Tela

## Fluxo

## Dado esperado

## Dado exibido

## Onde está salvo no banco

## Onde o frontend está tentando ler

## Causa raiz

## Tipo do erro

Básico / Regular / Mediano / Crítico

## Arquivos envolvidos

## Tabelas envolvidas

## Hooks/services envolvidos

## Correção recomendada

## Risco da correção

## Como testar depois

---

# CORREÇÃO ESPERADA

Corrigir de forma segura:

[ ] Ajustar queries  
[ ] Ajustar selects  
[ ] Ajustar joins  
[ ] Ajustar aliases  
[ ] Ajustar mappers  
[ ] Ajustar types TypeScript  
[ ] Ajustar accessors de tabela  
[ ] Ajustar renderização de campos  
[ ] Ajustar filtros  
[ ] Ajustar queryKeys/cache  
[ ] Ajustar invalidate/refetch  
[ ] Ajustar carregamento de modais  
[ ] Ajustar leitura de JSON/metadata  
[ ] Ajustar status aceitos  
[ ] Ajustar RLS, se necessário  

---

# RESULTADO FINAL ESPERADO

Ao final:

✅ Todo dado lançado pelo encarregado aparece no ERP principal  
✅ Toda operação por volume aparece completa  
✅ Toda diária aparece completa  
✅ Todo serviço extra aparece completo  
✅ Todo custo extra aparece completo  
✅ Toda tabela exibe os campos corretos  
✅ Todo modal carrega dados corretos  
✅ Todo filtro encontra registros corretos  
✅ Todo dashboard considera os registros corretos  
✅ Todo relatório considera os registros corretos  
✅ Nenhum dado salvo fica invisível  
✅ Nenhum campo válido aparece vazio indevidamente  

Comece pela tela de recepção/lançamentos operacionais e pelo fluxo de operação por volume, depois expanda a auditoria para todo o app.