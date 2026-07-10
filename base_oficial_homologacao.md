# Base Oficial de Homologação (Módulo Operacional e CLT)

## Objetivo
A Base Oficial de Homologação foi criada para estabelecer um ambiente seguro, permanente e totalmente isolado (Sandbox) destinado à validação de todo o pipeline corporativo do ERP ORBE. Ela impossibilita a mistura de massas de testes (mockadas) com dados reais das operações, garantindo auditorias seguras e previne falhas graves na apuração contábil/financeira de processos genuínos.

---

## Empresa
- **Nome:** Empresa Teste - Homologação
- **Finalidade:** Absorver operações, pontos e lotes financeiros criados em ambiente de testes para certificar regras de cálculo, automações e transições de status.
- **Regras de Utilização:** Atrelada irreversivelmente à flag administrativa `is_teste = true`. Nenhum lançamento financeiro ou CNAB originado sob a guarda desta empresa deve ser disparado em gateways de pagamento de produção sem o sandbox habilitado.

---

## Colaboradores (Massa Persistente de Testes)

Os colaboradores abaixo reproduzem todos os comportamentos-chave do Motor de Cálculo (Banco de Horas, Extra, Inconsistência e Atraso). Tais registros estão estabilizados e padronizados sob a mesma convenção.

| Código  | Matrícula | Cenário de Teste      | Tipo de Contrato | Objetivo da Validação                          |
|---------|-----------|-----------------------|------------------|------------------------------------------------|
| HML-001 | HML-001   | Jornada Normal        | Mensal           | Fluxo Feliz (Jornada perfeitamente completada) |
| HML-002 | HML-002   | Hora Extra            | Mensal           | Banco de Horas (Lidando com excedentes)        |
| HML-003 | HML-003   | Atraso                | Mensal           | Tolerâncias e Débitos (Redução de saldo)       |
| HML-004 | HML-004   | Batidas Incompletas   | Mensal           | Reprocessamento (Travamentos por erro RH)      |
| HML-005 | HML-005   | Jornada Especial      | Mensal           | Regras Especiais (Mapeamento cronológico D-1)  |

---

## Fluxos que utilizarão esta base
Esta infraestrutura será mandatoriamente utilizada na cadeia para homologação de:

- Workflow A (Pipeline Operacional)
- Workflow B (Importação Ponto CLT)
- Processamento RH & Fechamento de Folha
- Banco de Horas Global
- Financeiro (Faturamento de Contas a Receber)
- CNAB240 (Banco Itaú, Banco do Brasil, SISPAG)
- Conciliação Bancária
- Dashboard Gerencial e KPIs Administrativos
- DRE e Rateios de Unidades
- Operações por Volume & Faturáveis Especiais
- Serviços Extras e Justificativas de Custos
- Custos Extras
- Pipeline Diaristas & Intermitentes
- **Novas Funcionalidades Transversais do ERP ORBE.**

---

## Governança

Esta carta sela os seguintes manifestos técnicos no desenvolvimento do sistema:

1. **Vedação ao Mock Desorganizado:** Nenhuma homologação de módulos sistêmicos maduros deverá utilizar colaboradores reais corrompidos artificialmente se houver a possibilidade metodológica de usar o Cercadinho de Areia *(Base Oficial)*.
2. **Infraestrutura em Evolução:** Toda nova funcionalidade com cálculo matemático ou fluxo transacional deverá possuir pelo menos um cenário de teste mapeado dentro de um `CLT-HML-XXX` novo (Ex: HML-006 para Teste de Bonificação).
3. **Disponibilidade Permanente:** Os registros atuais da Base de Homologação **não deverão ser alterados em massa, descontinuados ou removidos**; eles mantêm o lastro dos testes regressivos para validações perenes a cada grande atualização da plataforma.
