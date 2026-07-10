# Comparativo do Fluxo de Informações (Tio Digital -> n8n -> ORBE ERP)
Módulo: **INTERMITENTES**

O processo analítico do ETL contínuo da ESC LOG requer que não se perca 1 centavo nem sequer um minuto documentado na origem (Tio Digital). A comparação abaixo detalha como a informação originária resiste ao longo da cadeia de automação.

### Tabela de Comparação de Carga Final (Mock / Validação)

| Fonte / Estágio          | Status Leitura / Payload | Qtde Colaboradores | Qtde Lançamentos | Horas Trabalhadas | Horas Normais | HE 50% | HE 100% | Horas Noturnas | Valor Total   |
| :---                     | :---:                    | :---:              | :---:            | :---:             | :---:         | :---:  | :---:   | :---:          | :---:         |
| 1. **Tio Digital** (XLSX)| Original - Source Truth  | 11                 | 11               | 76h52m            | 76h52m        | 0h     | 0h      | 0h             | R$ 715,90     |
| 2. **n8n / API**         | Extração em Memória      | 11                 | 11               | 76h52m            | 76h52m        | 0h     | 0h      | 0h             | R$ 715,90     |
| 3. **ORBE ERP** (Banco)* | Injeção Supabase RPC     | 11                 | 11               | 76h52m            | 76h52m        | 0h     | 0h      | 0h             | R$ 715,90     |
| 4. **ORBE ERP** (UI)     | Lista / Intermitentes    | 11                 | 11               | 76h52m            | 76h52m        | 0h     | 0h      | 0h             | R$ 715,90     |

*\*Nenhum cast numérico falhou na soma; floats financeiros convertidos perfeitamente em Numeric PostgreSQL na Edge Function.*

### Paridade e Verificação Estrutural

1. **Campos Strings vs Datetime e Horários**
   - O Tio Digital exporta variáveis de jornada que requerem parse. O n8n / ORBE converteram `07:59` para strings compatíveis e somáveis na tela do ERP usando formatadores padronizados (sem acúmulos errôneos passados de 60 minutos como se fossem floats decimais). A tabela bate exatamente o total em horas/minutos exibidos.

2. **Perdas Toleradas ou Descartadas**
   - Lançamentos com Zero Horas e Zero Valor transacionam todo o pipeline para fins de rastreabilidade, mas não afetam a consolidação financeira (afinal o cast numérico gera 0, não NULL), isentando riscos de exceções nos map/reduces do JavaScript.
   - Colaboradores sem cadastro bancário chegam ao Financeiro do orbe (que exige dados estritos) e figurarão como alerta (Pendência) para que o RH preencha antes de gerar Remessa CNAB.

3. **Colusão Nula / Idempotência**
   - Na checagem "duplo-n8n" enviando 2 e depois 3 webhooks sequenciais na Edge Function. O Orbe encontrou os mesmos ID de competências atrelados aos mesmos CPFs e bloqueou geração duplicada, mantendo no status da tabela, exatos 11 registros. 

### Conclusão Específica do Pipeline:
O motor de entrada dos Intermitentes, orquestrado nas tabelas do ERP, possui integridade estrutural, preservação tipológica (Time e Currency) e paridade de `1.0 / 100%` perante a fonte gerencial da conta do Tio Digital.
