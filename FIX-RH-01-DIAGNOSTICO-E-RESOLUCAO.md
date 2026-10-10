# ERP ORBE — FIX-RH-01
## Diagnóstico da Causa Raiz e Resolução Efetiva de Pendências em Lotes de Intermitentes

**Data:** 10/10/2026  
**Módulo:** Pessoas & RH → Central de Aprovações RH (`/rh/aprovacoes`) & Cadastros (`/colaboradores`)  
**Lote Auditado:** `6e48aa` (`6e48aa95-4f0e-43db-bf2b-5e39ea7dd53c`)  
**Competência:** `08/2026` | **Empresa:** `Operacional,Castanhal` | **Colaborador:** Rodrigo Ferreira Do Rosario  
**Status Operacional:** `AGUARDANDO_VALIDACAO_RH`  
**Status da Entrega:** ✅ Concluído com Sucesso (Pronto para Homologação pelo Usuário)

---

## 1. Causa Raiz Comprovada por Evidências Factuais

A auditoria de dados e de código identificou com precisão matemática o motivo do bloqueio e da navegação circular:

### 1.1 Por que o lote `6e48aa` estava bloqueado (Fail-Closed)?
O lote `6e48aa` possui 3 jornadas operacionais totalizando 19h23 e R$ 184,08 apurados. Todos os 3 lançamentos pertencem exclusivamente ao colaborador:
- **Nome:** Rodrigo Ferreira Do Rosario
- **ID:** `f4654fac-bf67-43be-b975-f214c6cf13d2`
- **Origem:** Integração externa (`tio_digital`)
- **Status Cadastral:** `PENDENTE_COMPLEMENTO` (`cadastro_provisorio: true`)

Ao inspecionar a função oficial `getColaboradorCompletudeDetailed(colaborador)`, comprovou-se que o colaborador possui três categorias de pendências obrigatórias:
1. **Identificação Pessoal / Operacional:**
   - `cpf`: `null` (ausente no banco de dados).
2. **Remuneração & Regra RH:**
   - `salario_base`: `null`, `valor_hora`: `null`, `valor_base`: `0` ("Valor base aplicável não definido").
3. **Dados Bancários para Pagamento:**
   - `banco_codigo`: `null`, `agencia`: `null`, `conta`: `null`, `tipo_conta`: `null`.

**Conclusão da causa raiz do bloqueio:** O princípio Fail-Closed funcionou perfeitamente para proteger o ERP, impedindo que um lote contendo um colaborador sem CPF, sem remuneração base e sem domicílio bancário avançasse para a esteira financeira e gerasse remessa CNAB rejeitada pelo banco.

---

### 1.2 Por que existia um Ciclo de Navegação Circular sem Resolução?
1. **No Drawer da Central de Aprovações (`AprovacaoDecisaoDrawer.tsx`):**
   - O componente apenas renderizava uma mensagem genérica de texto: *"Este lote de intermitentes possui inconsistências cadastrais ou de apuração."*
   - Não detalhava quais eram as pendências nem quem era o colaborador afetado.
   - O único botão oferecido era: *"Resolver no Módulo Especialista"*, chamando `getDominioRoute("INTERMITENTE")`, que redirecionava para `/intermitentes/lotes`.
2. **Na tela de Lotes de Intermitentes (`/intermitentes/lotes`):**
   - O lote já estava no status `AGUARDANDO_VALIDACAO_RH`.
   - O módulo de lotes não é um formulário de cadastro de colaboradores; seu único botão operacional para aquele status era: *"Ir para Validação RH"*, que apontava de volta para `/rh/aprovacoes`.
3. **Resultado:** Criava-se um ciclo fechado de navegação entre `/rh/aprovacoes` ⇄ `/intermitentes/lotes`, sem apontar para o módulo oficial responsável pela correção cadastral (`/colaboradores`).

---

## 2. Pendências Específicas Identificadas no Lote `6e48aa`

| Registro Afetado | ID do Colaborador | Categoria | Campo Faltante no Banco | Impacto |
| :--- | :--- | :--- | :--- | :--- |
| Rodrigo Ferreira Do Rosario | `f4654fac-bf67-43be-b975-f214c6cf13d2` | Cadastral / Pessoal | `cpf: null` | Não qualifica para emissão de folha nem remessa fiscal/bancária |
| Rodrigo Ferreira Do Rosario | `f4654fac-bf67-43be-b975-f214c6cf13d2` | Remuneração RH | `salario_base: null`, `valor_hora: null` | Impossibilita conferência contratual da taxa horária |
| Rodrigo Ferreira Do Rosario | `f4654fac-bf67-43be-b975-f214c6cf13d2` | Bancária | `banco_codigo: null`, `agencia: null`, `conta: null`, `tipo_conta: null` | Impede geração de lote de pagamento e registro no arquivo CNAB240 |

> **Observação de Privacidade e Segurança:** O diagnóstico no drawer agora discrimina apenas os **nomes dos campos ausentes**, sem jamais expor CPFs parciais ou dígitos de contas bancárias de outros operadores.

---

## 3. Arquivos Alterados

1. **`src/services/domain/intermitentes.service.ts`:**
   - Exportação das interfaces `PendenciaCompletudeLoteItem` e `CompletudeLoteResult`.
   - Evolução de `verificarCompletudeLote`: além de avaliar o Fail-Closed (`podeAprovar: boolean`), agora retorna `itensPendentes` estruturados, com identificador (`colaboradorId`), nome, matrícula, cargo, diagnóstico factual dividido em subseções (`operacional`, `rh`, `financeiro`), próxima ação recomendada e rotas oficiais de saneamento (`/colaboradores`).
   - Preservação total dos contratos legados (`pendencias: string[]`).

2. **`src/components/aprovacoes/AprovacaoDecisaoDrawer.tsx`:**
   - Substituição da mensagem estática e do link circular por um painel de diagnóstico estruturado no padrão obrigatório:
     **PROBLEMA → DIAGNÓSTICO → IMPACTO → PRÓXIMA AÇÃO → DESTINO CORRETO**.
   - Renderização individual de cada colaborador inconsistente em card dedicado.
   - **CTA Corretivo Real:** Botão *"Resolver Cadastro de [Nome]"* com ícone `FileEdit`, direcionando diretamente para `/colaboradores` com navegação contextual (`openEditId: colaboradorId`, `returnTo: "/rh/aprovacoes"`, `loteId: item.id`, `loteRef: item.referencia`).
   - Adição do botão *"Revalidar Integridade"* com ícone `RefreshCw` giratório, permitindo testar a liberação do lote sem sair do drawer.
   - Adição de item de validação de Intermitentes no **Checklist de Integridade & Regras de Negócio**.
   - Preservação integral do bloqueio Fail-Closed no botão de aprovação no rodapé (`disabled` enquanto houver pendências).

3. **`src/pages/Colaboradores.tsx`:**
   - Suporte a `returnContext` (`returnTo`, `loteId`, `loteRef`, `colaboradorNome`) e `pendingEditId`.
   - Abertura imediata e resiliente do modal de edição do colaborador indicado pelo drawer assim que a listagem é carregada.
   - Exibição de banner contextual informativo no topo do modal de edição:
     *"Regularização Cadastral para Aprovação RH (Lote 6e48aa) — Preencha o CPF, defina a remuneração (valor base/hora) e informe os dados bancários para viabilizar a aprovação na Central."*
   - Ao salvar (`createMutation.onSuccess`), exibição de toast informativo com ação de retorno rápido (*"Retornar à Central"*) e navegação automática de volta para `/rh/aprovacoes` com o contexto do lote preservado.

4. **`src/test/fix_rh_01_intermitentes_pendencias.test.tsx` (Novo):**
   - Suíte de 15 testes unitários e de integração validando todo o ciclo do FIX-RH-01.

---

## 4. Estrutura do Diagnóstico Implementado no Drawer

Seguindo estritamente a diretriz do projeto:

```text
[PROBLEMA]
Aprovação RH bloqueada preventivamente pela validação de integridade cadastral e operacional.

↓

[DIAGNÓSTICO FACTUAL]
Colaborador: Rodrigo Ferreira Do Rosario (Matrícula: Não informada)
• Identificação Pessoal: CPF não informado
• Remuneração & Regra RH: Valor base aplicável / valor hora não definido
• Dados Bancários para Pagamento: Banco, agência, conta e tipo de conta não informados

↓

[IMPACTO]
Lote impedido de gerar despesa financeira e remessa CNAB.

↓

[PRÓXIMA AÇÃO]
Completar os campos cadastrais pendentes (pessoal, remuneração e dados bancários) do colaborador no módulo de Cadastros.

↓

[DESTINO CORRETO]
Módulo: Cadastros / Colaboradores
Ação: [Resolver Cadastro de Rodrigo] (Abre modal de edição mantendo contexto e retorno)
Ação Secundária: [Revalidar Integridade] (Executa nova conferência no Supabase)
```

---

## 5. Evidências dos Testes Automatizados

### 5.1 Testes Unitários e Integrados do FIX-RH-01
```bash
npx vitest run src/test/fix_rh_01_intermitentes_pendencias.test.tsx
```
**Resultado:**
```text
 ✓ src/test/fix_rh_01_intermitentes_pendencias.test.tsx (15 tests)
   ✓ 1. ETAPA 01 — Diagnóstico da Causa Raiz & Contratos de Serviço
     ✓ 1.1 IntermitentesLoteService deve exportar as interfaces PendenciaCompletudeLoteItem e CompletudeLoteResult
     ✓ 1.2 verificarCompletudeLote deve auditar dados cadastrais, remuneração e bancários com Fail-Closed
     ✓ 1.3 PendenciaCompletudeLoteItem deve conter identificadores e rotas corretivas oficiais
   ✓ 2. ETAPA 02 — Diagnóstico Visível no Drawer (Problema -> Diagnóstico -> Impacto -> Ação -> Destino)
     ✓ 2.1 AprovacaoDecisaoDrawer deve manter bloqueio Fail-Closed estrito quando houver pendências
     ✓ 2.2 Drawer deve exibir a estrutura sequencial: PROBLEMA -> DIAGNÓSTICO -> IMPACTO -> PRÓXIMA AÇÃO -> DESTINO
     ✓ 2.3 Diagnóstico deve discriminar campos ausentes sem expor dados sensíveis
     ✓ 2.4 Checklist de Integridade & Regras de Negócio deve conter validação explícita de Intermitentes
   ✓ 3. ETAPA 03 — CTA Corretivo Real (Eliminação do Ciclo de Navegação Circular)
     ✓ 3.1 Drawer deve possuir CTA corretivo que navega diretamente para o cadastro do colaborador
     ✓ 3.2 Não deve direcionar para /intermitentes/lotes como meio de resolver cadastro do colaborador
   ✓ 4. ETAPA 04 — Retorno, Contexto e Revalidação
     ✓ 4.1 Colaboradores.tsx deve capturar e reter returnContext vindo de /rh/aprovacoes
     ✓ 4.2 Colaboradores.tsx deve exibir banner contextual de regularização para aprovação RH
     ✓ 4.3 createMutation.onSuccess deve disparar retorno fluído com toast de ação
     ✓ 4.4 AprovacaoDecisaoDrawer deve fornecer ação imediata de revalidação de integridade
   ✓ 5. Auditoria de Não-Regressão nos 6 Domínios Canônicos
     ✓ 5.1 Preserva os 6 domínios e seus tipos no Drawer
     ✓ 5.2 Preserva integrações em AprovacoesRh.tsx

Test Files  1 passed (1)
Tests       15 passed (15)
```

### 5.2 Testes de Regressão nos Módulos Correlatos
```bash
npx vitest run src/test/conv06_central_aprovacoes.test.tsx src/test/conv06_fix00_fail_closed.test.ts src/test/conv17_destino_rh.test.tsx
```
**Resultado:**
```text
 ✓ src/test/conv06_fix00_fail_closed.test.ts (8 tests)
 ✓ src/test/conv06_central_aprovacoes.test.tsx (24 tests)
 ✓ src/test/conv17_destino_rh.test.tsx (4 tests)

Test Files  3 passed (3)
Tests       36 passed (36)
```

### 5.3 Verificação de Tipagem TypeScript
```bash
npx tsc --noEmit
```
**Resultado:** Código de saída `0` (Zero erros em toda a base de código).

---

## 6. Limitações ou Bloqueios Restantes

- **Dados de Produção Intactos:** Os dados cadastrais do colaborador Rodrigo Ferreira Do Rosario permanecem propositalmente no estado atual (`PENDENTE_COMPLEMENTO`) no Supabase para que o usuário possa testar visualmente o bloqueio Fail-Closed, clicar em *"Resolver Cadastro de Rodrigo"*, salvar o cadastro completo e verificar a liberação da aprovação.
- **Nenhum Git Commit ou Push Realizado:** O código modificado está salvo localmente no repositório pronto para validação manual do usuário, sem qualquer commit automático.

---

## 7. Roteiro Sugerido para Validação Visual do Usuário

1. Acessar no navegador: `http://localhost:8080/rh/aprovacoes?tipo=INTERMITENTE`
2. Clicar no card/linha do lote `6e48aa` (Rodrigo Ferreira Do Rosario — `Operacional,Castanhal`).
3. Observar a abertura do Drawer de Decisão:
   - Notar o badge vermelho e o título: *"Decisão Bloqueada por Pendência Cadastral/Operacional (Fail-Closed)"*.
   - Notar a sequência: **Problema → Diagnóstico Factual (com sublistas Identificação, Remuneração e Dados Bancários) → Impacto → Próxima Ação**.
   - Notar o botão: *"Resolver Cadastro de Rodrigo"*.
   - Notar o botão *"Revalidar Integridade"*.
   - Notar que o botão *"Aprovar Lote"* no rodapé está bloqueado com *"Aprovação Bloqueada (Fail-Closed)"*.
4. Clicar no botão *"Resolver Cadastro de Rodrigo"*:
   - O sistema navega para `/colaboradores` e abre automaticamente o formulário do Rodrigo com o banner amarelo contextual no topo indicando a resolução do Lote `6e48aa`.
5. Preencher os campos pendentes (CPF, valor base/hora e dados bancários) e salvar:
   - O sistema exibe o toast com a opção de retornar à Central de Aprovações e efetua o redirecionamento preservando o contexto do lote.
6. Clicar em *"Revalidar Integridade"* no Drawer:
   - O alerta vermelho desaparecerá, o checklist de integridade passará para *"Conforme"* e o botão azul *"Aprovar Lote (R$ 184,08)"* será habilitado.
