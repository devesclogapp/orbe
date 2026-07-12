# Plano de Implantação Incrementa — Empresa Resolver V2 (Estratégia Zero Regressão)

O plano garante que o isolamento do módulo Self-Healing CLT não danificará a lógica consolidada, e sua replicação fechará o ralo operacional dos Intermitentes, escalando a confiabilidade geral de automações de Ponto.

---
## Sprint 1 — Extração do Método "Self-Healing" (EmpresaResolver)
* **Ação:** Construir uma solução agnóstica (`Helper` de Deno partilhado) importado pelos webook handlers OU (preferencialmente) uma RPC do Supabase, contendo fielmente a rotina do RHID (`SELECT FROM uniqueEmpresasMap... se null: INSERT cadastro_provisorio e gerar Random-CNPJ`).
* **Justificativa:** Garantir o bloco lógico acessível, encapsulando os mesmos parâmetros e tratativas que atualmente residem entre as linhas 170-202 do RHID, isolando a competência `resolveOrCreate`.

## Sprint 2 — Refatoração Direcionada na CLT (RHID/Manual)
* **Ação:** Refatorar cirurgicamente `importar-pontos-rhid/index.ts` e `importar-pontos-manual/index.ts`. Cortar as 50 linhas locais de checagem pesada e inserir a única chamada `await EmpresaResolver.resolve(nome, ...)` que retornará o UUID canônico (seja encontrado nativamente ou recém-criado temporário).

## Sprint 3 — Bateria de Regressão Completa CLT
* **Ação:** Disparar payloads via API do RHID e simular Upload Manual testando (1) Colaboradores e Empresas novas e (2) Colaboradores antigos presentes localmente. 
* **Critério de Aprovação:** Os registros persistem sem acusar perda estrutural ou duplicidades colaterais, validando a manutenção exata da premissa anterior.

## Sprint 4 — Adoção da Lógica no Tio Digital (Integrações Intermitentes)
* **Ação:** Aplicar o mesmo `EmpresaResolver.resolve()` dentro de `importar-intermitentes-tio/index.ts` (Workflow B), suprimindo ativamente as saídas por `fallbackEmpresaId = null`. Fazer o mesmo alinhamento de design pattern unificador em `importar-colaboradores-tio/index.ts` (Workflow A). 
* **Efeito Estrutural:** Doravante, Lançamentos Tio Digital não mais afogarão lotes inteiros pela flacidez de referências cruzadas ou "ausência de antecedência criativa do Wkf A".

## Sprint 5 — Regressão Completa Intermitentes
* **Ação:** Operar Homologação E2E disparando lançamentos com *Nomes de Empresa Erráticos ou Inéditos* nas rotas da API Supabase (simulando Tio Integrator). Lotes de fechamento são construídos sob a garantia do `EmpresaResolver`, finalizando o pipeline Intermitentes livre do bug de invisibilidade bancária (CNAB).

---
**Declaração Tecnológica:** Sendo concluídas estas implantações, nenhum componente da base oficial visual Administrativo/Comercial/Financeiro ou Operacional será prejudicado. Adiciona-se pura inteligência resiliente em portões automáticos da plataforma backend.
