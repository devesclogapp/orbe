# Checklist — Revalidação Fluxo Oficial Intermitentes

### ETAPA 01 — Revisão do Script de Homologação
- [x] O script `scripts/execute-fechar-periodo.js` ainda existe.
- [x] Continua realizando o `insert` direto na tabela `intermitentes_lotes_fechamento`.
- [x] Continua enviando `empresa_id: null` explicitamente.
- [x] Continua bypassando totalmente o `IntermitentesLoteService`.
> **Alerta:** Esse script **ainda representa risco** para futuras homologações e deve ser modificado/deletado para evitar sujar a base com lotes ilegítimos.

### ETAPA 02 — Revisão da Proteção do Service
- [x] Nenhum lote pode ser criado sem empresa no `IntermitentesLoteService.fecharPeriodo()`.
- [x] A validação `if (!lancamento.empresa_id) throw new Error(...)` bloqueia o fechamento.
- [x] A presença de `empresa_id` permanece estritamente obrigatória pela UI.
> É **impossível** criar lote sem empresa usando o frontend e a camada de serviço real. O ERP está protegido na raiz de seu domínio.

### ETAPA 03 — Resolução de Empresas (RHID vs Tio Digital)
Ao examinar `importar-intermitentes-tio` (Intermitentes) e `importar-pontos-rhid` (CLT):
- **Tio Digital:** Procura a empresa correspondente ao departamento via `getEmpresaIdFromDep()`. Caso não encontre por fuzzy, repassa o `empresa_id` como `null`, forçando ajuste visual sem contaminar domínios base.
- **RHID:** Se não encontrar o departamento, ele realiza um `insert({ nome: ... })`, criando o registro na tabela de `empresas` dinamicamente.
> **Risco Identificado:** A divergência de estratégias pode causar duplicidade. Se "Matriz ESC LOG" vier do Tio Digital, tentará achar a empresa; mas se no RHID vier "ESC LOG (Matriz)", o banco ganhará uma sub-empresa nova duplicada, dispersando lotes e faturamento.

### ETAPA 04 a 07 — Comportamento Oficial do Fluxo de Lotes
Sendo executado estritamente por tela:
- **Etapa 05 (Auditoria):** Todos os lotes criados apresentarão `empresa_id` válidos, pois o Serviço trava se for `null`.
- **Etapa 06 (Central Financeira):** O Financeiro utilizará a query limpa com `empresa_id` válida para listar todos os fluxos.
- **Etapa 07 (Central Bancária):** Como o status propaga naturalmente e o batch possui tenant e empresa corretos, todos chegarão perfeitamente e visíveis na listagem da aba do Banco respectivo do Lote.

### ETAPA 08 — Status das Pendências Cadastrais (Tio Digital incompleto)
- Pendências (CPF Inexistente, sem Conta, sem Banco):
  - **Bloqueiam Recepção?** NÃO. (`status_pipeline` fica em RECEBIDO independente disso)
  - **Bloqueiam Fechamento?** NÃO. (Agrupa e passa de fase desde que a `empresa_id` exista em tela)
  - **Bloqueiam RH?** NÃO. (Podem validar mesmo faltantes)
  - **Bloqueiam Financeiro?** NÃO. (Aprova financeiramente na promessa da regularização)
  - **Bloqueiam Listagem Bancária?** NÃO. (Permite visualizar o card aguardando trâmite CNAB)
  - **Bloqueiam Geração do CNAB?** **SIM.** 
  O método `gerarCNABParaLote` contém um validador iterativo que levanta erro se `faltando.length > 0`, interrompendo apenas o download do arquivo 240, exigindo "Atualize o cadastro de cada intermitente antes de gerar o CNAB".
