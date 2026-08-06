# Guia Prático de Uso — Fluxo de Intermitentes

## Objetivo
Este documento serve como um roteiro prático para guiar testes, auditorias e o uso diário do fluxo de **Intermitentes** no ERP Orbe. Ele descreve o caminho desde a captura da informação (entrada de dados) até o pagamento e conciliação bancária.

---

## 📍 Etiqueta de Rota: Captura / Entradas
O fluxo tem origem na captura dos apontamentos. Diferente das operações por volume lançadas manualmente, os dados dos intermitentes nascem (na sua maioria) através de processos automatizados ou importações de sistemas terceiros (ex: Tio Digital).

### Passo 1: Acesso e Conferência de Entradas
1. **Navegação:** Acesse o menu lateral `ENTRADAS / CAPTURA` e clique em **`Intermitentes Rec.`**
2. **O que observar:**
   - Visualize a tabela com a listagem de registros ou lotes de intermitentes gerados no ciclo.
   - Verifique a presença de informações chave:
     - Colaborador associado.
     - Empresa da prestação do serviço.
     - Período/Ciclo da jornada.
     - Status inicial (ex. *Pendente*, *Aguardando Fechamento*).
3. **Ações Práticas para Validação:**
   - Confirme se os colaboradores estão recebendo a base correta de cálculo para a competência.
   - Verifique se as ausências (faltas) ou presenças foram importadas corretamente.
   - Valide se não há informações faltantes (ex: cadastros PIS/CPF inconsistentes que possam travar o bancário).

---

## 📍 Etiqueta de Rota: Fechamento de Lote & Auditoria RH
Após os dias serem trabalhados e apontados, o agrupamento dessas diárias/hora deve ser encaminhado para validação oficial do Departamento de Recursos Humanos.

### Passo 2: Emissão e Aprovação pelo RH
1. **Navegação (Fechamento):** Se o fechamento for manual, selecione os registros do período na tela de captura e clique na ação de **Fechar Lote / Período**.
2. **Navegação (Validação RH):** Vá até o Painel do RH (normalmente `RH > Aprovações / Pendências`).
3. **O que observar:**
   - O lote de intermitentes recém-fechado deve constar aqui, com o status *`AGUARDANDO_VALIDACAO_RH`* ou *`EM_ANALISE_RH`*.
4. **Ações Práticas para Validação:**
   - Analise os totalizadores: Quantidade X Valor da Diária = Total Bruto.
   - Verifique eventuais descontos ou custos adicionais, dependendo da política.
   - Clique e **Aprove** o lote (Status para *`VALIDADO_RH`*). Em um teste manual, caso queira testar a devolução, rejeite o lote e acompanhe seu retorno à origem.

---

## 📍 Etiqueta de Rota: Execução Financeira
Uma vez validado pelo RH, o fluxo entra em sua reta final operacional, transformando-se em um passivo financeiro real.

### Passo 3: Autorização de Contas a Pagar
1. **Navegação:** Acesse o Painel Financeiro (`Financeiro > Aprovações Financeiras / Contas a Pagar`).
2. **O que observar:**
   - O lote aprovado pelo RH deve surgir automaticamente como uma pendência a ser avaliada pelo controle financeiro.
3. **Ações Práticas para Validação:**
   - Confira o extrato geral do lote (Empresa pagadora vs Dados do Colaborador vs Centros de Custo).
   - Autorize o pagamento clicando em **Aprovar**.
   - O status deve alterar para *`FECHADO_FINANCEIRO`*, sinalizando que o lote está pronto para a fila bancária.

### Passo 4: Geração de Remessa (CNAB 240)
1. **Navegação:** Vá em `Financeiro > Central Bancária (CNAB)`.
2. **O que observar:**
   - Os títulos correspondentes aos intermitentes estarão listados como pagamentos aptos.
3. **Ações Práticas para Validação:**
   - Selecione os registros de intermitentes e clique em **Gerar Remessa**.
   - O sistema irá gerar e baixar um arquivo no layout Itaú 240.
   - Verifique se os dados estão consistentes no arquivo gerado (sem quebra de layout, conta/agência preenchidos).
   - O status dos pagamentos deve transitar para indicar envio bancário.

### Passo 5: Baixa e Conciliação (Retorno)
1. **Navegação:** Vá em `Financeiro > Retornos Bancários`.
2. **O que observar e testar:**
   - Simule o recebimento do arquivo de retorno (`.ret`).
   - Faça o upload do arquivo no ERP.
   - Audite se o ERP interpreta o retorno liquidado com sucesso e abaixa a pendência financeira marcando definitivamente como *`PAGO`* ou *`CONCILIADO`*.

---

## 📋 Checklist de Validação Manual (Checklist do Testador)
Durante a sua experiência validando "Intermitentes Rec.", tente responder a estas perguntas:
- [ ] O fluxo de Tio Digital / sistema fonte alimentou a tela sem intervenção forçada?
- [ ] A formatação dos valores monetários e visuais da data são precisos?
- [ ] Consigo encontrar o colaborador? Existe controle sobre duplo apontamento?
- [ ] Existe log na *Timeline* do registro comprovando que passou pela etapa atual?
- [ ] A auditoria registrou o nome de quem fechou/aprovou as etapas sensíveis?

---
*Fim do Guia — Valide as ações acima para certificar o funcionamento do Fluxo de Intermitentes no ERP Orbe.*
