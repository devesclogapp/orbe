# RELATÓRIO DE AUDITORIA PRÉ-CHECKPOINT 05

## Objetivo da Auditoria
Responder com base em evidências do código se o problema reportado na aba Central Bancária para Intermitentes ("0 lotes encontrados") é proveniente de **ausência física dos lotes na base de dados** ou **um bloqueio das consultas (regras de negócio do RH/Financeiro)**. 

---

### Diagnóstico Sistemático (Etapas 01 a 07)

Constatou-se na Etapa 05 da auditoria os seguintes filtros sendo aplicados pela interface:
1. `CentralBancaria.tsx` -> `IntermitentesLoteService.getByEmpresaParaFinanceiro()`
2. Os filtros via SDK do Supabase enviados ao BD limitam a busca em:
   - `empresa_id` === [Filtro Front-end]
   - `status` IN `['VALIDADO_RH', 'FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'cnab_gerado']`

**Isto prova que a consulta não possui mecanismos de ocultação que mascarem lotes sem preenchimento completo de Cadastro (como CPF, PIS e dados bancários).**
Qualquer lote orgânico `FECHADO_FINANCEIRO`, independente da completude do RH e seus colaboradores, tem o dever arquitetural de retornar para preencher a Fila da tela (listagem). 

### Fator "Regras de Negócio"
A premissa imposta pela auditoria existe, é correta e intencional. E ela foi confirmada dentro do `TioDigital / IntermitentesLoteService.gerarCNABParaLote`. Contudo, esta regra afeta apenas quando a ação **Gerar CNAB** for invocada para o backend (linha 337 a 344), falhando ativamente e reportando na tela todos os colaboradores incompletos via exceção técnica (`toast`).

---

### Causa Raiz Oficial
**[Opção A / Opção C]** -> O Fator é ligado diretamente aos [Dados]. 

Os lotes do CP04 não estão sendo encontrados porque organicamente, **não existem no ambiente testado**. A base pode ter sido instanciada nula de uma snapshot efêmera ou o cadastro ocorreu usando usuários/tenants com chaves de RLS apartadas do login vigente na infraestrutura.

---

### Resposta a Etapa 09 (Parecer)
**🟢 O problema está nos dados.**

---

### Resposta a Etapa 10 (Recomendação)
1. Deve ser implementada uma cadeia de dados real (Seeding) ou reiniciado os processos da `Integração Tio Digital` -> `Módulo Operacional` -> `Aprovação RH` -> `Fechamentos Financeiros` de forma end-to-end, submetendo os CPFs pelo fluxo integral, para então as baterias do *Checkpoint 05* serem engatilhadas de forma sólida.
2. Confirmar que a chave/senha correspondente ao Tenant de testes está salva e ativa em variáveis consistentes na homologação.
