# GATE DE GOVERNANÇA — GATE-06
## Auditoria de Não-Regressão Final e Homologação de Entrega

---

### 1. IDENTIFICAÇÃO E METADADOS

- **Identificador Único:** `GATE-06`
- **Título:** Auditoria de Regressão Geral e Encerramento de Homologação
- **Módulos Abrangidos:** Todos (RH, Diaristas, CLT, Financeiro, Operações, Dashboard, Governança, Navegação)
- **Data Prevista:** 10/11/2026 / 11/11/2026
- **Status Funcional:** **PENDENTE DE EXECUÇÃO**
- **Status Git:** **NÃO EXECUTADO**
- **Status de Deploy:** **BLOQUEADO ATÉ APROVAÇÃO INTEGRAL**

---

### 2. OBJETIVO DO GATE 06

Validar de ponta a ponta que todas as correções e evoluções recentes:
1. `EVOL-DASH-02-P01` (Reconciliação Semanal do Dashboard Executivo);
2. `FIX-DASH-02-SQL-01` (Correção da query SQL sem coluna inexistente);
3. `NAV-02` (Implementação das correções de navegação contextual);
4. `DOC-01` (Organização da rastreabilidade técnica documental);

**NÃO provocaram nenhuma regressão** nos módulos fundamentais já homologados e estáveis do ERP ORBE.

---

### 3. CHECKLIST DE VERIFICAÇÃO OBRIGATÓRIA

#### Domínio A — RH & Folha (Regra de Ouro: Intocabilidade)
- [ ] Lançamentos de Diaristas e fechamento semanal de lote continuam íntegros.
- [ ] Processamento de Ponto CLT, tolerâncias e cálculo de horas mantidos sem alteração.
- [ ] Regras e convocações de Intermitentes operacionais preservadas.
- [ ] Aprovação RH e envio para lote financeiro sem duplicidade.

#### Domínio B — Financeiro & Despesas
- [ ] Geração de Remessa CNAB 240 (Itaú) mantida sem desvios.
- [ ] Custos Extras operacionais permanecem bloqueados de entrar no CNAB.
- [ ] Chave canônica `ORIGEM:ID` em `despesasOficial.service.ts` continua garantindo unicidade.
- [ ] Conciliação de Retorno Bancário 1:N funcional.

#### Domínio C — Operações & Receitas
- [ ] Portal do Encarregado (`/producao/*`) e guardas de rota (`PortalGuard`) íntegros.
- [ ] Lançamento de Operações por Volume calculando corretamente `volume * unitario`.
- [ ] Faturamento oficial e Contas a Receber desacoplados de regras de folha.

#### Domínio D — Dashboard Executivo & Integridade Visual
- [ ] KPIs mensais e Gráfico Semanal em paridade aritmética.
- [ ] Respeito estrito aos estados: `ok`, `sem_dados`, `inconsistente`, `erro`.
- [ ] Filtros por empresa, competência e ambiente de teste/produção funcionais.

#### Domínio E — Compilação, Tipagem e Testes Automatizados
- [ ] `npm run type-check` (TypeScript estrito) aprovado com 0 erros.
- [ ] `npm run test` / `vitest` aprovado em todos os testes unitários e de integração.
- [ ] `npm run build` gerando bundle de produção sem avisos impeditivos.

---

### 4. CRITÉRIOS DE APROVAÇÃO (GO / NO-GO)

- **GO (Aprovado):** 100% dos itens do checklist validados; 0 regressões detectadas; build limpo.
- **NO-GO (Reprovado):** Qualquer quebra em RH, Financeiro ou divergência nos cálculos financeiros homologados.

---

### 5. HISTÓRICO DE AUDITORIA E ASSINATURA

| Data | Responsável | Veredito | Observações |
| :---: | :---: | :---: | :--- |
| *Pendente* | Arquiteto / QA Sênior | **PENDENTE** | Aguardando conclusão da Etapa NAV-02 e autorização do usuário |

