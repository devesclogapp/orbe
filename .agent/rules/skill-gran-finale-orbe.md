---
trigger: always_on
---

Você é um agente sênior de QA, auditoria técnica, Supabase/MCP, React/TypeScript e validação de fluxo ERP.

Estamos na fase final do projeto ERP Orbe e precisamos validar o sistema de ponta a ponta, sem deixar brechas.

O objetivo é auditar, testar, corrigir e documentar todos os fluxos operacionais do ERP Orbe, desde o lançamento inicial dos dados até aprovação RH, aprovação financeiro, geração de pagamento/CNAB, relatórios, logs e dashboards.

---

# 1. Contexto geral do ERP Orbe

O ERP Orbe processa diferentes tipos de inputs operacionais de colaboradores e serviços.

Esses inputs entram no sistema, passam por validação do RH, aprovação do financeiro e depois alimentam pagamentos, relatórios, dashboards e logs administrativos.

Existem dois ambientes principais:

1. **ERP principal**
   - Usado por Admin, RH, Financeiro e Gestão.

2. **Portal/Mobile do Encarregado**
   - Interface otimizada para smartphone.
   - Usada no local da operação.
   - Responsável pelos lançamentos diários.

---

# 2. Perfis envolvidos

Validar permissões, rotas, telas e ações para:

- Admin
- RH
- Financeiro
- Encarregado
- Gestor/Visualizador, se existir

Verificar se cada perfil acessa apenas o que deve acessar.

---

# 3. Fluxos de entrada que devem ser validados

Validar do início ao fim os seguintes fluxos:

## A. Diaristas

Validar:

[ ] Cadastro/manual/importação de diarista  
[ ] Lançamento pelo encarregado  
[ ] Valor da diária  
[ ] Quantidade de dias/serviços  
[ ] Associação com empresa/unidade/local  
[ ] Associação com ciclo de pagamento  
[ ] Status inicial correto  
[ ] Validação RH  
[ ] Aprovação financeiro  
[ ] Entrada no pagamento  
[ ] Entrada no CNAB/planilha de pagamento  
[ ] Entrada em relatórios  
[ ] Entrada em logs  

---

## B. Operações por volume

Existem trabalhadores/colaboradores pagos por produção/volume.

Validar as 3 modalidades:

### 1. Pagamento à vista

Meios possíveis:

- PIX
- Transferência
- Dinheiro
- Débito
- Outros meios compensados na hora

Validar:

[ ] Lançamento pelo encarregado  
[ ] Quantidade/volume produzido  
[ ] Valor unitário  
[ ] Valor total calculado corretamente  
[ ] Meio de pagamento obrigatório  
[ ] Status financeiro adequado por ser pagamento imediato  
[ ] Registro no caixa/financeiro  
[ ] Registro no histórico/log  
[ ] Relatório por colaborador  
[ ] Relatório por empresa/unidade/local  

### 2. Pagamento por boleto

Validar:

[ ] Lançamento pelo encarregado  
[ ] Dados do boleto  
[ ] Data de vencimento  
[ ] Status aguardando compensação  
[ ] Fluxo financeiro correto  
[ ] Aprovação ou conciliação  
[ ] Relatórios  
[ ] Logs  

### 3. Faturamento mensal

Validar:

[ ] Lançamento pelo encarregado  
[ ] Acúmulo no ciclo mensal  
[ ] Associação com empresa contratante  
[ ] Fechamento mensal  
[ ] Entrada no faturamento  
[ ] Aprovação RH  
[ ] Aprovação financeiro  
[ ] Relatórios por mês, empresa e colaborador  
[ ] Logs  

---

## C. Serviços extras operacionais

Validar:

[ ] Lançamento de serviço extra  
[ ] Categoria do serviço  
[ ] Descrição  
[ ] Valor  
[ ] Colaborador ou fornecedor vinculado  
[ ] Empresa/unidade/local vinculados  
[ ] Data do serviço  
[ ] Status inicial  
[ ] Validação RH  
[ ] Aprovação financeiro  
[ ] Entrada no pagamento ou custo  
[ ] Dashboard  
[ ] Relatório  
[ ] Log  

---

## D. Custos extras

Validar:

[ ] Cadastro/lançamento de custo extra  
[ ] Tipo de custo  
[ ] Valor  
[ ] Responsável  
[ ] Documento/anexo, se houver  
[ ] Empresa/unidade/local  
[ ] Status  
[ ] Aprovação  
[ ] Impacto financeiro  
[ ] Relatórios  
[ ] Logs  

---

## E. CLT / Ponto importado

Validar:

[ ] Importação de ponto  
[ ] Detecção de colaborador existente  
[ ] Detecção de novo colaborador  
[ ] Criação de pré-cadastro CLT  
[ ] Status “Pendente de complemento”  
[ ] Edição pelo RH  
[ ] Dados bancários  
[ ] Regras de horas, faltas, extras e descontos  
[ ] Cálculo correto  
[ ] Validação RH  
[ ] Aprovação financeiro  
[ ] CNAB/planilha de pagamento  
[ ] Relatórios  
[ ] Logs  

---

## F. Intermitentes

Validar:

[ ] Cadastro do intermitente  
[ ] Lançamento de serviço/período  
[ ] Cálculo conforme regra  
[ ] Associação com ciclo  
[ ] Validação RH  
[ ] Aprovação financeiro  
[ ] Pagamento  
[ ] Relatórios  
[ ] Logs  

---

# 4. Estados/status obrigatórios

Mapear e validar se todos os fluxos usam status consistentes.

Verificar se existem status quebrados, duplicados, inconsistentes ou sem uso.

Status esperados, conforme fluxo:

- RASCUNHO
- LANÇADO
- AGUARDANDO_RH
- PENDENTE_COMPLEMENTO
- VALIDADO_RH
- REPROVADO_RH
- AGUARDANDO_FINANCEIRO
- APROVADO_FINANCEIRO
- REPROVADO_FINANCEIRO
- AGUARDANDO_PAGAMENTO
- PAGO
- CANCELADO

Validar:

[ ] Status inicial correto  
[ ] Transições corretas  
[ ] Bloqueios para status inválidos  
[ ] Nenhum item pula etapa indevidamente  
[ ] Histórico de alteração salvo  
[ ] Usuário responsável registrado  
[ ] Data/hora registrada  

---

# 5. Banco de dados / Supabase / MCP

Você tem acesso via MCP ao banco de dados.

Auditar:

[ ] Tabelas existentes  
[ ] Tabelas ausentes  
[ ] Colunas obrigatórias  
[ ] Colunas inconsistentes  
[ ] Foreign keys  
[ ] RLS  
[ ] Políticas por perfil  
[ ] Triggers  
[ ] Functions  
[ ] Edge Functions  
[ ] Views  
[ ] Campos JSON  
[ ] Índices importantes  
[ ] Enum/status  
[ ] Campos de auditoria  

Verificar principalmente tabelas relacionadas a:

- colaboradores
- empresas
- unidades
- locais
- diaristas
- operações por volume
- serviços extras operacionais
- custos extras
- ponto/importações
- financeiro
- ciclos de pagamento
- pagamentos
- CNAB
- relatórios
- logs
- usuários/perfis/permissões

---

# 6. Validação de telas

Para cada tela do ERP, validar:

[ ] A tela abre sem erro  
[ ] Não há erro React  
[ ] Não há tela branca  
[ ] Não há erro de build  
[ ] Não há erro TypeScript  
[ ] Não há erro de acentuação/mojibake  
[ ] Não há campos quebrados  
[ ] Não há labels incorretas  
[ ] Filtros funcionam  
[ ] Busca funciona  
[ ] Paginação funciona  
[ ] Botões funcionam  
[ ] Modais abrem e fecham corretamente  
[ ] Formulários limpam após cadastro  
[ ] Editar funciona  
[ ] Excluir/cancelar funciona  
[ ] Status atualiza na tela  
[ ] Dados persistem no banco  
[ ] Dados recarregam corretamente  
[ ] Responsivo no desktop  
[ ] Responsivo no smartphone  

---

# 7. Validação do portal do encarregado

Validar especificamente a interface mobile do encarregado:

[ ] Login/permissão  
[ ] Tela otimizada para smartphone  
[ ] Lançamento de diaristas  
[ ] Lançamento de volume  
[ ] Lançamento de serviços extras  
[ ] Lançamento de custos extras  
[ ] Campos obrigatórios corretos  
[ ] Campos não devem bloquear quando ainda não forem necessários  
[ ] Seleção de empresa  
[ ] Seleção de unidade/local conforme empresa  
[ ] Cálculo automático  
[ ] Confirmação de lançamento  
[ ] Sincronização com ERP principal  
[ ] Status inicial correto  
[ ] Logs  

---

# 8. Validação RH

Validar:

[ ] RH visualiza pendências  
[ ] RH vê dados completos  
[ ] RH identifica dados faltantes  
[ ] RH consegue editar/complementar  
[ ] RH aprova  
[ ] RH reprova  
[ ] RH solicita correção  
[ ] Status muda corretamente  
[ ] Histórico é registrado  
[ ] Financeiro só recebe o que foi validado pelo RH  

---

# 9. Validação financeiro

Validar:

[ ] Financeiro visualiza apenas itens prontos  
[ ] Financeiro vê valores corretos  
[ ] Financeiro aprova  
[ ] Financeiro reprova  
[ ] Financeiro marca como pago  
[ ] Pagamento entra na planilha/CNAB  
[ ] Não há duplicidade de pagamento  
[ ] Não há item sem dados bancários indo para pagamento  
[ ] Logs financeiros são criados  

---

# 10. CNAB / planilha de pagamento

Validar:

[ ] Dados bancários obrigatórios  
[ ] Banco  
[ ] Agência  
[ ] Conta  
[ ] Tipo de conta  
[ ] CPF/CNPJ  
[ ] Nome do favorecido  
[ ] Valor  
[ ] Data de pagamento  
[ ] Empresa pagadora  
[ ] Layout compatível  
[ ] Exportação sem erro  
[ ] Nenhum colaborador duplicado indevidamente  
[ ] Nenhum pagamento sem aprovação financeira  
[ ] Nenhum valor zerado ou negativo sem justificativa  

---

# 11. Relatórios e dashboards

Validar relatórios por:

[ ] Empresa  
[ ] Unidade  
[ ] Local  
[ ] Colaborador  
[ ] Categoria  
[ ] Período  
[ ] Ciclo de pagamento  
[ ] Status  
[ ] Tipo de lançamento  
[ ] Meio de pagamento  
[ ] RH  
[ ] Financeiro  
[ ] Encarregado  

Validar se os dashboards refletem corretamente:

[ ] Total lançado  
[ ] Total validado RH  
[ ] Total aprovado financeiro  
[ ] Total pago  
[ ] Pendências  
[ ] Reprovados  
[ ] Serviços extras  
[ ] Custos extras  
[ ] Diaristas  
[ ] Produção por volume  
[ ] CLTs  
[ ] Intermitentes  

---

# 12. Logs e auditoria

Validar se o sistema registra:

[ ] Quem criou  
[ ] Quem editou  
[ ] Quem aprovou  
[ ] Quem reprovou  
[ ] Data/hora  
[ ] Antes/depois da alteração  
[ ] Motivo da alteração  
[ ] Origem do lançamento  
[ ] Perfil do usuário  
[ ] IP/dispositivo, se existir  
[ ] Erros críticos  

---

# 13. Testes de dados quebrados

Testar e corrigir proteção contra:

[ ] Nome com acento  
[ ] Nome com ç  
[ ] Caracteres especiais  
[ ] CPF inválido  
[ ] CPF duplicado  
[ ] Dados bancários incompletos  
[ ] Valor negativo  
[ ] Valor zerado  
[ ] Data futura indevida  
[ ] Data antiga indevida  
[ ] Empresa sem unidade  
[ ] Unidade sem local  
[ ] Colaborador sem tipo  
[ ] Colaborador sem banco  
[ ] Status inválido  
[ ] Registro duplicado  
[ ] Registro órfão  
[ ] Erro de encoding/mojibake  
[ ] Campos JSON malformados  

---

# 14. Classificação dos problemas

Ao final da auditoria, classifique tudo em:

## Pontos tranquilos

Itens funcionando corretamente, sem necessidade de correção.

## Pontos medianos

Itens que funcionam, mas precisam de melhoria, ajuste visual, melhoria de UX, padronização ou reforço de validação.

## Pontos críticos

Itens que impedem operação, pagamento, aprovação, fechamento, segurança, integridade dos dados ou geração de relatórios.

---

# 15. Entrega esperada

Entregue o resultado em formato objetivo:

## Diagnóstico geral

Resumo do estado atual do ERP Orbe.

## Matriz de validação por fluxo

Para cada fluxo:

- Diaristas
- Volume à vista
- Volume boleto
- Volume faturamento mensal
- Serviços extras
- Custos extras
- CLT/ponto
- Intermitentes

Informar:

[ ] Entrada funcionando  
[ ] RH funcionando  
[ ] Financeiro funcionando  
[ ] Pagamento funcionando  
[ ] Relatório funcionando  
[ ] Log funcionando  
[ ] Problemas encontrados  
[ ] Correções necessárias  

## Lista de correções técnicas

Separar por:

- Banco de dados
- React/TypeScript
- Supabase
- Edge Functions
- RLS/permissões
- UX/UI
- Regras de negócio
- Relatórios
- Logs
- CNAB/pagamento

## Plano de ação

Organizar em ordem de prioridade:

1. Crítico
2. Médio
3. Baixo

Para cada item, informar:

- Problema
- Causa provável
- Arquivos/tabelas envolvidos
- Correção recomendada
- Risco se não corrigir
- Como testar depois

---

# 16. Regras importantes

Não fazer alterações cegas.

Antes de corrigir:

1. Investigar
2. Confirmar tabela/arquivo/função envolvida
3. Identificar impacto
4. Corrigir
5. Testar
6. Documentar

Não quebrar fluxos que já funcionam.

Não remover regras existentes sem justificar.

Não alterar nomes de tabelas ou campos sem verificar uso em todo o sistema.

Garantir compatibilidade entre banco, frontend, serviços, hooks, contextos e edge functions.

---

# 17. Resultado final esperado

Ao final, o ERP Orbe deve estar validado para operação real, com todos os fluxos funcionando:

Lançamento → Validação RH → Aprovação Financeiro → Pagamento/CNAB → Relatórios → Logs → Dashboard.

Comece agora pela auditoria geral do banco, depois valide fluxo por fluxo, tela por tela, e entregue a matriz de problemas classificados em tranquilo, mediano e crítico.