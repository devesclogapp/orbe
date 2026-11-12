# REGISTRO TÉCNICO CENTRAL — ERP ORBE
## Índice Canônico de Rastreabilidade, Evoluções, Correções e Auditorias

> **Finalidade:** Tabela central de rastreabilidade do ERP ORBE. Cada entrega, evolução, correção ou auditoria transversal possui um identificador unívoco, status funcional comprovado por evidências, status em controle de versão (Git), status de deploy e link para sua respectiva ficha técnica detalhada.  
> **Governança:** Antes de iniciar qualquer nova alteração ou homologação, consulte este índice para verificar dependências, contratos e pendências em aberto.

---

### 1. MATRIZ CONSOLIDADA DE RASTREABILIDADE

| ID Único | Demanda / Descrição Técnica | Módulo / Domínio | Origem / Auditoria | Status Funcional | Status Git | Status Deploy | Ficha Detalhada | Pendências / Próximo Passo |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **EVOL-DASH-02-P01** | Reconciliação financeira semanal do Dashboard Executivo com paridade contábil aos cartões mensais | Dashboard Executivo / Gráfico Semanal | GATE 05 / ENC-01 | **HOMOLOGADO** | NÃO COMMITADO | NÃO PUBLICADO | [Ficha Técnica](fichas-tecnicas/EVOL-DASH-02-P01.md) | Integrar no pacote de commit/deploy do GATE 06 |
| **FIX-DASH-02-SQL-01** | Correção da query PostgREST removendo referência à coluna inexistente `receitas_operacionais.data_operacao` | Dashboard / Reconciliação | Homologação Set/2026 | **HOMOLOGADO** | NÃO COMMITADO | NÃO PUBLICADO | [Ficha Técnica](fichas-tecnicas/FIX-DASH-02-SQL-01.md) | Integrar no pacote de commit/deploy do GATE 06 |
| **AUD-NAV-01** | Auditoria transversal de navegação contextual interna e diagnóstico do caso piloto DRE | Transversal (Dashboard, DRE, Torre) | Divergência Set/2026 no DRE | **CONCLUÍDA** | DOCUMENTADO | NÃO PUBLICADO | [Relatório](auditorias/AUD-NAV-01-navegacao-contextual.md) | Implementação das correções na fase NAV-02 |
| **AUD-NAV-01.1** | Revisão técnica das 58 navegações, reclassificação dos 40 apontamentos e definição de contratos | Transversal | Auditoria NAV-01 | **CONCLUÍDA** | DOCUMENTADO | NÃO PUBLICADO | [Relatório](auditorias/AUD-NAV-01.1-revisao-contratos.md) | Execução priorizada dos 16 defeitos na fase NAV-02 |
| **NAV-02-L01** | Correção da navegação contextual Dashboard → DRE Gerencial (Competência mensal, anual, empresa e fallback) | Dashboard ↔ DRE Gerencial | AUD-NAV-01 / Item 01 Matriz | **IMPLEMENTADO (TESTADO)** | NÃO COMMITADO | NÃO PUBLICADO | [Ficha Técnica](fichas-tecnicas/NAV-02-L01.md) | Aguardando homologação funcional da coordenação |
| **NAV-02-L01.2** | Confiabilidade dos KPIs do Dashboard Executivo (estados de erro/retry, isolamento visual em troca de contexto e inadimplência oficial nos drawers) | Dashboard Executivo / Drawers / Inadimplência | Auditoria NAV-02-L01.1 | **HOMOLOGADO** | NÃO COMMITADO | NÃO PUBLICADO | [Ficha Técnica](fichas-tecnicas/NAV-02-L01.2.md) | Homologação funcional confirmada em 11/11/2026 (8 evidências manuais + 7 suítes/104 testes reportados); navegação contextual segue para NAV-02-L01.3 |
| **FIX-NAV-02-L01.2-01** | Correção do tratamento de falhas de rede/offline nos KPIs, refetch desatualizado no Drawer e falhas independentes no Radar de Atenção | Dashboard Executivo / Service / Drawers / Radar | Homologação NAV-02-L01.2 | **HOMOLOGADO** | NÃO COMMITADO | NÃO PUBLICADO | [Adendo na Ficha Técnica](fichas-tecnicas/NAV-02-L01.2.md) | Homologação funcional confirmada em 11/11/2026 com recuperação automática pós-offline e aviso explícito sem zeros fictícios |
| **NAV-02-L01.3-A** | Correção da navegação contextual Dashboard Executivo → Receitas Operacionais (`?mes=` mensais/`YYYY-all`, empresa/Consolidado, seletor dinâmico, F5 e isolamento de ambiente/tenant) | Dashboard Drawers / Receitas Operacionais | Auditoria NAV-02-L01.3 | **IMPLEMENTADO (TESTADO)** | NÃO COMMITADO | NÃO PUBLICADO | [Ficha Técnica](fichas-tecnicas/NAV-02-L01.3-A.md) | Aguardando homologação funcional da coordenação; NAV-02-L01.3-B (Central Financeira) e Central Bancária mantidos fora de escopo |
| **FIX-GATE-ENTREGA-01** | Eliminação de truncamento silencioso (`.limit(1000)` / teto PostgREST) em Receitas, `qRetornoItens` (Dashboard), Conciliação de Receitas e Inadimplência + correção de 2 asserções legadas em `conv09` | Receitas / Dashboard / Conciliação / Inadimplência | Gate de Entrega | **IMPLEMENTADO (TESTADO)** | NÃO COMMITADO | NÃO PUBLICADO | [Ficha Técnica](fichas-tecnicas/FIX-GATE-ENTREGA-01.md) | 8 suítes / 133 testes aprovados + `type-check` + `build`; pronto para revisão/commit do pacote de entrega |
| **NAV-02-L01.3-B** | Correção da navegação contextual Dashboard Executivo → Central Financeira (`?mes=` mensais/`YYYY-all` com aviso explícito, empresa/Consolidado sem auto-seleção de `empresas[0]`, F5 e isolamento de ambiente/tenant) | Dashboard Drawers / Central Financeira | Auditoria NAV-02-L01.3 | **IMPLEMENTADO (TESTADO)** | NÃO COMMITADO | NÃO PUBLICADO | [Ficha Técnica](fichas-tecnicas/NAV-02-L01.3-B.md) | 5 suítes / 118 testes aprovados + `type-check` + `build`; NAV-02-L01.3-C mantida fora de escopo |
| **NAV-02-L01.3-C** | Remoção do atalho inadequado `"Abrir Central Bancária"` (`/bancario`) no drawer `Caixa & Contas` do Dashboard Executivo, preservando acesso contextual exclusivo a Receitas & Cobranças | Dashboard Drawers (`Caixa & Contas`) | Auditoria NAV-02-L01.3 | **IMPLEMENTADO (TESTADO)** | NÃO COMMITADO | NÃO PUBLICADO | [Ficha Técnica](fichas-tecnicas/NAV-02-L01.3-C.md) | 4 suítes / 100 testes aprovados + `type-check` + `build`; Central Bancária e CNAB preservados sem alteração |
| **GATE-06** | Auditoria de não-regressão geral (RH, Diaristas, CLT, Financeiro, Dashboard, Build) | Governança Geral | Encerramento de Fase | **PENDENTE** | NÃO EXECUTADO | BLOQUEADO | [Gate 06](gates/GATE-06-regressao-final.md) | Executar após autorização formal da coordenação |

---

### 2. ESTRUTURA DE DIRETÓRIOS DA DOCUMENTAÇÃO TÉCNICA

A documentação canônica e histórica do ERP ORBE está organizada no diretório `docs/` da seguinte forma:

```text
docs/
  ├── REGISTRO_TECNICO.md         # Este índice mestre consolidado
  ├── fichas-tecnicas/            # Especificações completas de evoluções e correções (EVOL-*, FIX-*)
  │     ├── EVOL-DASH-02-P01.md   # Reconciliação financeira semanal
  │     └── FIX-DASH-02-SQL-01.md # Correção de coluna SQL
  ├── auditorias/                 # Relatórios de auditoria e varreduras técnicas (AUD-*)
  │     ├── AUD-NAV-01-navegacao-contextual.md
  │     └── AUD-NAV-01.1-revisao-contratos.md
  ├── gates/                      # Checklists e atas de gates de governança (GATE-*)
  │     └── GATE-06-regressao-final.md
  ├── changelog/                  # Registros cronológicos de versões e deploys
  ├── homologacao/                # Documentos históricos da fase de homologação
  └── procedimentos/              # Manuais e POPs operacionais
```

---

### 3. CONVENÇÃO DE IDENTIFICADORES

- `EVOL-<MODULO>-<NUM>`: Evoluções e novas funcionalidades incrementais.
- `FIX-<MODULO>-<NUM>`: Correções de defeitos ou bugs encontrados em homologação/produção.
- `AUD-<DOMINIO>-<NUM>`: Auditorias técnicas estruturais, de segurança ou usabilidade.
- `GATE-<NUM>`: Marcos de validação e não-regressão obrigatórios antes de promoções de versão.

---

### 4. REGRAS DE MANUTENÇÃO DESTE REGISTRO

1. **Atualização Imediata:** Todo agente ou desenvolvedor que concluir uma etapa, auditoria ou fix deve registrar a entrada nesta tabela antes de submeter a entrega.
2. **Evidência Obrigatória:** Nenhum status pode ser marcado como `HOMOLOGADO` sem constar na respectiva ficha técnica a suíte de testes executada ou logs comprobatórios.
3. **Imutabilidade Histórica:** As entradas passadas refletem a evolução do sistema e nunca devem ser excluídas, apenas atualizadas quanto a status de deploy/git.

