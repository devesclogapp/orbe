# Parecer Final — Arquitetura de Resolução de Empresas

**1. Existe realmente uma divergência arquitetural?**
**SIM.** A estratégia varia diametralmente entre canais de importação, oscilando de "Criação Induzida Cega" num pipeline (RHID) até a permissividade `null` noutro (Tio Digital), demonstrando descentralização e inconsistência na injeção.

**2. Ela representa risco futuro?**
**SIM.** Empresas zumbis sem dados configurados no backend quebram rastreabilidade cross-company, distorcem BI operacional e anulam a exatidão financeira na integração CNAB por falhas de configuração bancária atrelada e falta de CNPJ legítimo.

**3. Qual é a arquitetura recomendada?**
`Alias-Based Gatekeeper Centralizado`. Apenas dados que mapeem identicamente o nome oficial ou um Apelido Controlado (Alias explicitado) deverão ultrapassar a barreira limítrofe das Webhooks em direção às tabelas de lançamento normatizadas, operando através de uma Stored Procedure (RPC) no PostgreSQL.

**4. Vale a pena unificar?**
**SIM, É MANDATÓRIO.** Trata-se do nó estrutural mais importante de conectividade de receitas e despesas no ORBE atual. Unidades sem sincronia exata fragmentam o sistema financeiro inteiro.

**5. Essa unificação aumenta a robustez do ERP?**
**SIM.** Ao estancar a poluição no Banco de Dados:
- Simplifica as consultas em tela;
- Remove condicionalidades perigosas (`coalesce()`) em views financeiras;
- Alivia concorrências nas Edge Functions;
- Entrega uma percepção visual coesa que infunde muita transparência e confiança no operador do ERP.
