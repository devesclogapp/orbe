# ERP ORBE — IMPLANTAÇÃO ASSISTIDA | ETAPA 2 (REVISÃO FINAL)
## DIAGNÓSTICO DE EMPRESAS, PRECIFICAÇÃO E PRONTIDÃO OPERACIONAL

**Ambiente:** Supabase de Produção + ERP ORBE (`https://orbe-nu.vercel.app`)  
**Modo:** Auditoria Técnica READ-ONLY (Somente Leitura)  
**Data:** 03/11/2026  
**Referência:** Diretrizes do Adendo de Homologação ERP ORBE  

---

## 1. RESUMO EXECUTIVO

Esta revisão final do diagnóstico da Etapa 2 consolida a auditoria profunda da arquitetura do ERP ORBE, separando rigorosamente:
1. **O que é capacidade técnica do software (Engenharia e Motores)**;
2. **O que é limitação dos dados de teste atuais (Homologação Controlada)**;
3. **O que são pendências cadastrais da empresa cliente (Implantação Assistida)**;
4. **O que constitui risco funcional com necessidade de decisão de gestão**.

### Principais Conclusões:
- **Homologação Técnica:** O motor de cálculo de volumes, a resolução de regras por prioridade ponderada, a apuração tributária de ISS (5%), o isolamento multitenant (RLS), o RBAC de segurança e a contenção de empresas sintéticas (P0-01) estão **100% HOMOLOGADOS E APROVADOS**.
- **Investigação do Valor R$ 0,00:** O banco de dados suporta legitimamente operações com valor zero para atender a cenários reais de logística (retrabalho interno, cortesia comercial ou movimentação física para controle de produtividade). A permissão de valor zero **não é um defeito técnico**, mas a falta de um alerta na interface quando uma regra de preço não é encontrada configura um **Risco Funcional (Categoria B)**.
- **Veredito Geral:** **APTO PARA IMPLANTAÇÃO ASSISTIDA**.

---

## 2. MATRIZ REVISADA DE CLASSIFICAÇÃO

Em cumprimento às diretrizes de auditoria, todas as constatações foram enquadradas em quatro categorias padronizadas:

| Categoria | Descrição do Critério |
|---|---|
| **A — Defeito Técnico Comprovado** | Comportamento comprovadamente incorreto no software, contrariando a especificação técnica. |
| **B — Risco Funcional** | Comportamento que pode gerar erro operacional na ponta, dependente de política de negócio ou salvaguarda visual. |
| **C — Limitação de Dados de Homologação** | Ausência ou simplificação de dados fictícios que não impediu a validação técnica da funcionalidade. |
| **D — Pendência de Implantação** | Dados comerciais, fiscais ou cadastrais definitivos que devem ser providos pela ESC LOG na entrada em produção. |

### 2.1 Quadro Consolidado de Constatações

| Constatação Auditada | Categoria | Evidência Técnica Identificada | Impacto no Software |
|---|:---:|---|---|
| **Empresas cadastradas como postos/departamentos sem CNPJ** | **D** | 9 das 10 empresas têm `cnpj = null` e `origem_detalhe` indicando departamentos do Tio Digital / RHID. | O ERP opera normalmente; o preenchimento de CNPJ e dados fiscais será realizado na parametrização contábil do cliente. |
| **Duplicidade nominal `Castanhal,Operacional` e `Operacional,Castanhal`** | **D** | Chaves primárias distintas criadas em 15/07/2026 via integração externa. | Unificação cadastral recomendada durante a operação assistida para consolidar escalas. |
| **Ausência de transportadoras e fornecedores reais no catálogo** | **C** | Apenas `TransAraguaia` e registros com sufixo `Fictício - Onboarding` cadastrados. | Não bloqueia o software. Permitiu validar com sucesso todas as chaves estrangeiras e relacionamentos. |
| **25 colaboradores intermitentes ativos sem CPF** | **D** | Registros criados via pré-cadastro de ponto sem preenchimento de documentos fiscais. | O encarregado consegue escalá-los operacionalmente; o RH deverá inserir os CPFs antes do envio da folha ao CNAB bancário. |
| **Catálogo de preços contendo apenas 1 regra (`Descarga TransAraguaia R$ 0,42`)** | **C** | Tabela `fornecedor_valores_servico` possui 1 linha ativa de teste com todos os relacionamentos consistentes. | A regra validou com êxito a RPC, a fórmula $\text{Volume} \times \text{Unitário}$, a alíquota de ISS e o reflexo financeiro. |
| **Operação gravada com valor R$ 0,00 quando não há regra cadastrada** | **B** | O campo `valor_unitario` é `readOnly` e o banco permite `valor_total >= 0`. Sem regra, o total fica R$ 0,00 sem aviso de tela. | Operações não faturáveis são válidas no negócio, mas lançamentos acidentais sem cobrança podem ocorrer por falta de alerta. |
| **Prevenção de empresas sintéticas no pré-cadastro RHID** | **Homologado** | `createMinimalEmpresa` lança exceção e `ensurePreCadastros` desvia registros inválidos para `INCONSISTENTE`. | Fix P0-01 (commit `04c00e6`) plenamente operacional no ambiente publicado. |

---

## 3. INVESTIGAÇÃO ESPECÍFICA: OPERAÇÕES COM VALOR R$ 0,00

Uma análise aprofundada foi realizada no banco de dados, nos schemas de validação e nos fluxos financeiros do ERP ORBE para determinar a natureza das operações com valor zero.

### 3.1 Operações sem regra de preço podem ser persistidas com valor zero?
**SIM.**  
- **No Banco de Dados:** A constraint de integridade em `public.operacoes_producao` estabelece:
  ```sql
  valor_unitario_snapshot NUMERIC(15,4) NOT NULL CHECK (valor_unitario_snapshot >= 0),
  valor_total NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0)
  ```
  A regra do banco permite explicitamente valores iguais a zero (`>= 0`).
- **No Formulário (`OperacaoForm.tsx`):** O esquema Zod (`schema.ts`) define `valor_unitario: z.coerce.number().optional()`.
- **Na Interface (`FormStepSummary.tsx`):** O campo `valor_unitario` é renderizado como `readOnly`. Se a RPC `resolver_valor_operacao` não encontrar correspondência na tabela de preços (`status_regra = 'missing'`), o valor unitário não é preenchido, resultando em $\text{Total} = \text{Quantidade} \times 0 = \text{R\$\ } 0,00$. O sistema permite a submissão e grava com sucesso.

### 3.2 Existe conferência ou aprovação posterior que impeça o faturamento indevido?
**SIM, EM NÍVEL VISUAL E DE CONFERÊNCIA ADMINISTRATIVA:**
- Na Central de Operações (`Operacoes.tsx`), o Administrador e o Financeiro visualizam todas as operações lançadas com seus respectivos valores totais destacados em coluna própria.
- Na listagem de Operações por Volume, existe a opção de **Edição Administrativa**, permitindo ao Administrador corrigir preços, quantidades ou associar a regra contratual correta antes da emissão de cobranças.
- No pipeline de faturamento mensal e conciliação (`Receitas.tsx`), itens com valor R$ 0,00 entram na fatura como R$ 0,00, sem gerar títulos de cobrança financeira ativos com valores inconsistentes.

### 3.3 Existem operações legitimamente gratuitas na logística?
**SIM.**  
No modelo de operação logística da ESC LOG e do setor de movimentação de cargas, operações com valor R$ 0,00 são previstas e legítimas em três situações:
1. **Retrabalho Operacional:** Refação de palletização ou re-movimentação de carga decorrente de desalinhamento interno, sem repasse de custo ao cliente contratante.
2. **Cortesia Comercial / Bonificação:** Descarregamento de veículos de devolução ou volumes promocionais isentos por cláusula contratual.
3. **Apontamento de Produtividade Física:** Operações registradas exclusivamente para mensurar o volume trabalhado pelos colaboradores escalados (para banco de horas ou pagamento de equipe), sem gerar duplicata contra o cliente tomador.

*Conclusão:* A permissão de valor R$ 0,00 no banco de dados **não é um defeito de software**, mas um requisito de flexibilidade da operação logística.

### 3.4 O comportamento representa defeito comprovado ou risco funcional?
**Representa um RISCO FUNCIONAL (Categoria B).**  
- O defeito não está no banco aceitar R$ 0,00.
- O risco reside na **usabilidade do formulário operacional**:
  - Como o campo `valor_unitario` está bloqueado para edição (`readOnly`), se o Encarregado estiver realizando uma operação faturável legítima, mas o Administrador tiver esquecido de cadastrar a regra previamente, o operador **não tem como digitar o valor acordado** e o formulário **não exibe nenhum alerta preventivo** informando que a operação está sendo salva sem precificação.

### 3.5 É necessária uma proteção adicional antes da implantação real?
- **Não há necessidade de alterar a estrutura do banco ou reabrir migrations.**
- **Recomendação Operacional Imediata:** Procedimento de implantação: o Administrador deve cadastrar as regras comerciais ativas antes da abertura dos turnos.
- **Recomendação de Interface (Melhoria Evolutiva Simples):** Exibir um alerta amarelo no resumo do lançamento quando o valor unitário for R$ 0,00:  
  *“Atenção: Nenhuma regra de preço configurada para este parceiro/serviço. Esta operação será registrada com valor R$ 0,00 (não-faturável). Deseja continuar?”*

---

## 4. DETALHAMENTO DAS 10 EMPRESAS E EVIDÊNCIAS DE SUPORTE

| Empresa | Origem Técnica | Evidência Direta no Banco | Papel na Operação Assistida | Classificação |
|---|:---:|---|---|:---:|
| **Empresa Teste - Homologação** | `manual` | `cnpj: 00000000000100`, `is_teste: true` | Ambiente de testes controlados e simulação | **C** |
| **BENEVIDES** | `tio_digital` | `origem_detalhe: "Empresa provisória criada via departamento..."` (19 colabs, 13 ops) | Base física operacional ativa da ESC LOG em Benevides | **D** |
| **DISMELO CASTANHAL** | `rhid_api` | Criada em lote em 08/07/2026 às 23:41:14 (17 colabs) | Posto de operação dedicada Dismelo em Castanhal | **D** |
| **Evidencia Operacional** | `rhid_api` | Criada em lote em 08/07/2026 às 23:41:11 (26 colabs) | Turno diurno importado do coletor de ponto | **D** |
| **Evidencia Noite** | `rhid_api` | Criada em lote em 08/07/2026 às 23:41:12 (10 colabs) | Turno noturno importado do coletor de ponto | **D** |
| **Encarregado GARRA** | `rhid_api` | Criada em lote em 08/07/2026 às 23:41:12 (8 colabs) | Posto de equipe operacional externa | **D** |
| **Escritório RH** | `rhid_api` | Criada em lote em 08/07/2026 às 23:41:14 (4 colabs) | Departamento de apoio administrativo interno | **D** |
| **Operacional Noturno** | `tio_digital` | `origem_detalhe: "Empresa provisória..."` (3 colabs) | Turno noturno importado do Tio Digital | **D** |
| **Castanhal,Operacional** | `tio_digital` | `origem_detalhe: "Empresa provisória..."` (2 colabs) | Posto Castanhal (duplicado por inversão de texto) | **D** |
| **Operacional,Castanhal** | `tio_digital` | `origem_detalhe: "Empresa provisória..."` (1 colab) | Posto Castanhal (duplicado por inversão de texto) | **D** |

---

## 5. REGRAS DE PREÇOS E DEPENDÊNCIAS DE IMPLANTAÇÃO

### 5.1 Regra de Teste Existente
- **Configuração:** `fornecedor_valores_servico` $\rightarrow$ Serviço: `Descarga` + Transportadora: `TransAraguaia Logística Ltda` = **R$ 0,42**.
- **Comprovação de Cálculo:**
  - 1.000 caixas descarregadas = R$ 420,00 de descarga base.
  - Alíquota canônica de 5% de ISS (com NF marcada) = R$ 21,00 de retenção tributária.
  - Total faturável gerado = R$ 441,00.
  - Cálculo validado com exatidão pelo motor financeiro.

### 5.2 Quadro de Responsabilidades para a Implantação Assistida

```text
┌─────────────────────────────────────────────────────────────┬──────────────────────────┐
│ Ação Requerida na Implantação                               │ Responsável              │
├─────────────────────────────────────────────────────────────┼──────────────────────────┤
│ Inserir CNPJ e Razão Social formal nas bases Benevides/Cast.│ Gestão Administrativa    │
│ Cadastrar as Transportadoras comerciais ativas              │ Administrador do ERP     │
│ Cadastrar os Fornecedores comerciais ativos                 │ Administrador do ERP     │
│ Cadastrar as Regras de Preço acordadas com os clientes      │ Administrador do ERP     │
│ Inserir CPFs dos 25 colaboradores intermitentes             │ RH / Departamento Pessoal│
│ Unificar os postos duplicados de Castanhal                  │ Gestão de Cadastros      │
└─────────────────────────────────────────────────────────────┴──────────────────────────┘
```

---

## 6. VEREDITO ATUALIZADO DE HOMOLOGAÇÃO

> ### **VEREDITO: APTO PARA IMPLANTAÇÃO ASSISTIDA**
> - **Homologação Técnica:** **100% CONCLUÍDA E APROVADA**. Não existem defeitos técnicos de cálculo, integridade ou segurança bloqueando a operação.
> - **Condição Operacional:** Toda operação comercial que for iniciada pelo Encarregado em produção deve ter sua respectiva **Regra de Preço préalavelmente cadastrada pelo Administrador** em `/regras-operacionais`, evitando que serviços faturáveis sejam registrados acidentalmente com valor zerado.

---

## 7. RECOMENDAÇÃO OBJETIVA PARA A PRÓXIMA ETAPA

Recomenda-se avançar para a **Etapa 3 da Implantação Assistida: Primeiro Lançamento Operacional Real Controlado**, observando o seguinte roteiro:
1. O Administrador cadastra previamente a Transportadora e a Regra de Preço correspondente à primeira carga real.
2. O Encarregado executa o lançamento assistido no portal operacional mobile.
3. A equipe acompanha a transição automática da receita para o Contas a Receber e a conferência de produtividade dos colaboradores envolvidos.
