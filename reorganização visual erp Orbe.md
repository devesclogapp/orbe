# REORGANIZAÇÃO VISUAL E ARQUITETURAL DO ERP ESC LOG (SEM QUEBRAR O SISTEMA)

## CONTEXTO

O ERP já está funcional.

Os dados já entram corretamente através de:
- API de pontos
- formulário operacional externo do encarregado
- lançamentos de diaristas
- custos operacionais

O sistema já:
- processa os dados
- calcula resultados
- consolida informações
- exibe dashboards
- possui telas funcionais

NÃO queremos:
- recriar sistema
- quebrar lógica existente
- alterar regras atuais
- refatorar backend inteiro
- modificar drasticamente banco de dados
- alterar funcionamento já operacional

O objetivo é:
# reorganizar a EXPERIÊNCIA e o FLUXO VISUAL do ERP
para que ele pareça um:
# CENTRO DE PROCESSAMENTO OPERACIONAL CORPORATIVO

e não apenas um conjunto de telas CRUD.

---

# OBJETIVO PRINCIPAL

Criar uma camada de:
- organização visual
- agrupamento lógico
- percepção operacional
- fluxo por setor
- pipeline de processamento

SEM alterar a lógica central já existente.

---

# ARQUITETURA REAL DO ERP

## O encarregado NÃO usa o ERP principal.

Ele usa:
- um formulário operacional externo
- tela simplificada
- acesso operacional separado

Esse formulário envia:
- operações
- cargas
- descargas
- serviços
- diaristas
- custos
- produção

Esses dados entram no ERP.

---

## Os pontos entram via API.

---

## O ERP principal funciona como:

# CENTRAL DE PROCESSAMENTO

O ERP:
- recebe
- valida
- processa
- consolida
- gera pagamentos
- gera faturamento
- gera relatórios

---

# FLUXO REAL DOS DADOS

## 1. INPUTS EXTERNOS

### API de Pontos
→ envia jornadas e horas

### Formulário Operacional
→ envia operações, diaristas e custos

↓

## 2. TELAS DE PROCESSAMENTO

- Operações
- Pontos
- Diaristas
- Custos

↓

## 3. PROCESSAMENTO INTERNO

- validações
- regras
- cálculos
- banco de horas
- cruzamento de dados

↓

## 4. DASHBOARD

- visão consolidada
- produtividade
- custos
- pagamentos
- faturamento

↓

## 5. FINANCEIRO

- pagamentos
- CNAB
- TXT bancário
- remessas

↓

## 6. RELATÓRIOS

- operacional
- RH
- financeiro
- auditoria

---

# ESTRUTURA DE USUÁRIOS

---

# ADMIN

Função:
- governança geral
- supervisão
- auditoria
- acompanhamento do fluxo
- usuários e permissões
- visão global

O admin NÃO é operador de lançamento.

---

# RH

Função:
- cadastro estrutural do sistema
- colaboradores
- diaristas
- serviços
- empresas/clientes
- fornecedores
- transportadores
- regras
- banco de horas
- jornadas
- validações RH

IMPORTANTE:
O formulário operacional do encarregado deve puxar os dados cadastrados pelo RH.

---

# FINANCEIRO

Função:
- receber fechamentos já processados
- gerar pagamentos
- gerar CNAB/TXT
- gerar remessas bancárias
- faturamento
- análise financeira
- relatórios financeiros

O financeiro NÃO valida operação bruta.

---

# OBJETIVO DA IMPLEMENTAÇÃO

SEM alterar o funcionamento atual:
- reorganizar menu
- reorganizar experiência
- melhorar percepção de fluxo
- transformar ERP em pipeline operacional visual

---

# IMPLEMENTAÇÕES SOLICITADAS

# 1. REORGANIZAR MENU LATERAL

SEM quebrar rotas existentes.

Apenas reorganizar visualmente.

---

# NOVA ESTRUTURA DO MENU

## DASHBOARD
- visão consolidada
- alertas
- indicadores
- pendências

---

## ENTRADAS OPERACIONAIS
(subtítulo: dados recebidos)

- Operações Recebidas
- Pontos Recebidos
- Diaristas Recebidos
- Custos Operacionais

IMPORTANTE:
essas telas já existem.
Apenas reorganizar.

---

## PROCESSAMENTO RH
(subtítulo: validação e tratamento)

- Banco de Horas
- Validações RH
- Regras Operacionais
- Regras de Banco
- Fechamentos RH

---

## CADASTROS E ESTRUTURA
(subtítulo: base operacional)

- Colaboradores
- Diaristas
- Empresas/Clientes
- Serviços
- Fornecedores
- Transportadores
- Equipes

---

## FINANCEIRO
(subtítulo: pagamentos e faturamento)

- Fechamentos
- Pagamentos
- Remessas
- CNAB/TXT
- Faturamento

---

## RELATÓRIOS E GOVERNANÇA

- Central de Relatórios
- Auditoria
- Logs
- Indicadores

---

# 2. NÃO ALTERAR ROTAS EXISTENTES

Manter:
- componentes
- páginas
- queries
- cálculos
- regras
- backend

Apenas:
- reorganizar visualmente
- criar agrupamentos
- alterar títulos
- melhorar UX

---

# 3. CRIAR STATUS VISUAIS

Adicionar status operacionais SEM alterar a lógica central.

Exemplos:

## Operações
- Recebido
- Em Validação RH
- Processado
- Aguardando Financeiro
- Pago

## Diaristas
- Lançado
- Validado
- Fechado
- Enviado ao Banco
- Pago

## Pontos
- Recebido
- Inconsistente
- Validado
- Fechado

Usar:
- badges
- chips
- cores suaves
- indicadores visuais

---

# 4. CRIAR “CENTRAL OPERACIONAL”

Nova página resumo.

SEM substituir telas atuais.

Objetivo:
mostrar pipeline operacional do RP.

Essa página deve:
- agrupar dados recebidos
- mostrar pendências
- mostrar fluxo
- redirecionar para telas existentes

Exemplo:
- operações recebidas hoje
- diaristas pendentes
- jornadas inconsistentes
- aguardando fechamento
- aguardando financeiro

---

# 5. MELHORAR O DASHBOARD

O dashboard deve parecer:
# um centro operacional vivo

e não apenas cards numéricos.

Adicionar:
- etapas do fluxo
- pendências por setor
- dados aguardando RH
- dados aguardando financeiro
- pagamentos pendentes
- fechamentos da semana
- valores processados

---

# 6. PERSONALIZAR EXPERIÊNCIA POR PERFIL

SEM alterar sistema de permissão já existente.

Apenas adaptar:
- menu
- foco visual
- atalhos
- dashboard

---

## ADMIN vê:
- visão geral
- gargalos
- produtividade
- auditoria

---

## RH vê:
- jornadas
- validações
- banco de horas
- inconsistências
- colaboradores

---

## FINANCEIRO vê:
- pagamentos
- CNAB
- remessas
- faturamento
- fechamentos

---

# 7. NÃO QUEBRAR O QUE JÁ FUNCIONA

NÃO:
- recriar tabelas
- mover lógica crítica
- refatorar backend inteiro
- alterar integrações
- alterar cálculos existentes

FAZER:
# camada visual e organizacional acima da estrutura atual.

---

# RESULTADO ESPERADO

O ERP deve transmitir visualmente:

# INPUT → PROCESSAMENTO → FECHAMENTO → PAGAMENTO → RELATÓRIOS

O sistema deve parecer:
# um centro corporativo de processamento operacional logístico

e não apenas:
# um conjunto de telas administrativas.