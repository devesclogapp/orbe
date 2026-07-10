# Auditoria Arquitetural — Motor RH (CLT)

## 1. Módulos e Componentes Principais

O Motor RH do ORBE é uma implementação centralizada no frontend, isolada do backend (com exceção de RPCs esporádicas), responsável pelo fechamento de banco de horas, geração de créditos, débitos, recálculos e classificação de anomalias/inconsistências operacionais baseadas nos pontos extraídos do RHiD. 

**Componente Central:** `src/services/rhProcessing.service.ts`

### 1.1 Processo de Triagem e Sanidade (Cadastral)
A função `validateColaboradorApto` garante o isolamento entre pipelines. Restrições estritas e imutáveis:
- **Segregação Diaristas:** Colaboradores tipo `DIARISTA` são bloqueados na porta de entrada (não participam de Banco de Horas).
- **Cadastro Provisório:** Colaboradores sem cadastro concluído ou `status_cadastro = 'pendente_complemento'` são paralisados no pipeline operando como "Inconsistência". Não gera saldos financeiros.
- **Modelos de Contrato:** Sem modelo de cálculo / contrato, o registro é rejeitado por impossibilidade matemática.

### 1.2 Cálculos de Jornada (`calculateCompensation`)
- **Tolerâncias:** Usa os parâmetros `tolerancia_atraso` e `tolerancia_hora_extra` via regra de empresa. Subtrai excedentes ou débitos tolerados até que se alcance um saldo real.
- **Minutos Diários e Atrasos:** Resolve se o saldo é positivo ou negativo (`saldoBase > 0 = EXTRA`, `< 0 = DEBITO`).
- **Valoração Diária e Extra (`valorDia`):** Usa um fator multiplicador `EXTRA_RATE = 1.5` (50% de hora extra como padrão hardcoded) e extrai o `valor_hora` ou divide o `salario_base` pela `jornada * 22`.

### 1.3 Identificação de Inconsistências
O sistema gera flags críticas e interrupções em `buildInconsistencias`:
- Batida ímpar (Sem entrada/Sem saída).
- Saída menor que entrada.
- Intervalo inválido (Retorno antes da saída pro almoço).
- Divergências massivas (> 5 minutos) entre horas computadas vs importadas.

### 1.4 Estado, Trilha e Persistência de Dados
O pipeline age no Supabase consumindo a view de pontos pendentes, gravando nos seguintes artefatos inter-relacionados de IDEMPOTÊNCIA:
- `registros_ponto` (`status_processamento` muda para `PROCESSADO` ou `INCONSISTENTE`).
- `processamento_rh_inconsistencias` (Gera ticket de revisão para o RH).
- `banco_horas_eventos` (Extrato diário garantindo OCC na coluna `saldo_anterior`).
- `banco_horas_saldos` (Upsert por `tenant_id` e `colaborador_id`).

### Riscos Observados:
1. Multiplicador de Extras (`EXTRA_RATE = 1.5`): Codificado rigidamente no service, não é dinâmico pela convenção. Pode necessitar refatoração futura se a ESC Log adotar extras de 100%.
2. A atualização do saldo parece não utilizar RLS ou RPC 100% transacional para o incremento atômico (`saldo_atual = saldo_atual + novo_saldo`), preferindo cálculo de state no frontend `replaceRhEventoByRegistro`.

## Conclusão da Fase 1
Motor mapeado com sucesso. Arquitetura é robusta, as dependências são contidas e a idempotência ocorre na inserção dos Eventos do Banco de Horas. O foco da Etapa 2 a 6 será estressar a validação matemática gerada por `calculateCompensation`.
