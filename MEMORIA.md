# MEMORIA.md — Estado Técnico, Decisões e Histórico Homologado

> **Finalidade:** Registro histórico e evolutivo do ERP ORBE. Documenta decisões de arquitetura consolidadas, marcos de homologação alcançados, contratos a preservar, dívidas técnicas mapeadas e pendências operacionais.  
> **Versão de Referência:** Commit `33fa738` (HEAD homologado em produção).

---

## 1. Marcos de Homologação Confirmados

O ERP ORBE concluiu com sucesso seus principais ciclos de validação formal. Conforme atestado no documento oficial [docs/homologacao/EVIDENCIAS_CONSOLIDADAS_HOMOLOGACAO_ORBE.md](docs/homologacao/EVIDENCIAS_CONSOLIDADAS_HOMOLOGACAO_ORBE.md):

### 1.1 GATE FINAL de Produção (Aprovado em 09/11/2026)
- **Status Oficial:** 100% Aprovado nos 4 fluxos operacionais E2E + 33 cenários de RLS e integridade financeira (FIX-08).
- **Evidências Registradas:**
  - **Fluxo 1 — Operação por Volume:** Validado E2E do Portal do Encarregado à tela de Operações do ERP (Registro ID `5171d7fd-a6eb-4ac3-84f1-6e1016c66084`, 500 volumes de descarga, valor R$ 600,00, persistido em `production_entries` com colaboradores vinculados).
  - **Fluxo 2 — Diaristas:** Validado fechamento de ciclo semanal e apuração de lote (Lote ID `c3fe4374-6e3e-48f5-869b-c6bebd06374d`, R$ 150,00, status `AGUARDANDO_VALIDACAO_RH`).
  - **Fluxo 3 — Serviços Extras:** Validado lançamento operacional de Paletização (Registro ID `2d964ec5-c304-4474-a1c8-285cc3c27591`, R$ 350,00, status `PENDENTE`).
  - **Fluxo 4 — Custos Extras:** Validado lançamento de Lanche Operacional (Registro ID `2a754038-135e-4aaa-b47d-d9d6becd1db8`, R$ 125,00, status `RECEBIDO`).
  - **Segurança e RLS (FIX-08):** 27 cenários de validação via PostgREST com tokens JWT reais de Admin, RH, Financeiro e Encarregado.
  - **Regras Financeiras (FIX-08):** 6 cenários de cálculo de margem DRE, retenções e imutabilidade de lotes.

---

## 2. Decisões Arquiteturais Registradas (Decisões Documentadas)

### Decisão 01: Desacoplamento Total entre Receitas e Despesas
- **Contexto:** Necessidade de evoluir o faturamento operacional sem provocar regressões no processamento de folha de RH já homologado.
- **Decisão:** Criar pipelines completamente independentes. O módulo de Receitas ([receitasOficial.service.ts](src/services/receitasOficial.service.ts)) gerencia faturamento, cobranças e recebimentos de clientes. O módulo de Despesas ([despesasOficial.service.ts](src/services/despesasOficial.service.ts)) gerencia custos de colaboradores, diaristas e despesas operacionais.
- **Regra:** Nunca compartilhar regras de cálculo ou tabelas de status entre ambos.
- **Referência:** [.agent/rules/evolucao-operacao-volume.md](.agent/rules/evolucao-operacao-volume.md).

### Decisão 02: Federação Canônica de Despesas com Chave Composta (`ORIGEM:ID`)
- **Contexto:** Consolidação de múltiplas fontes de despesa (CLT, Intermitentes, Diaristas e Custos Extras) no módulo de Contas a Pagar e DRE.
- **Decisão:** Utilizar chave composta unificada no formato `ORIGEM:ID_CANONICO` para deduplicação em memória no adapter [despesasOficial.service.ts](src/services/despesasOficial.service.ts), evitando criar tabelas intermediárias ou alterar enums no banco de dados.

### Decisão 03: Proibição Estrita de Custos Extras no CNAB
- **Contexto:** Risco de despesas operacionais locais (alimentação, EPIs, combustível) gerarem ordens de transferência bancária em lote.
- **Decisão:** Custos extras são classificados como pagamentos locais ou reembolsos; estão **proibidos** de entrar no motor gerador de remessas bancárias CNAB.

### Decisão 04: Isolamento Sintético da Base de Homologação
- **Contexto:** Risco de testes de homologação poluírem dados reais da ESC Log em produção.
- **Decisão:** Criação de colaboradores sintéticos isolados (`CLT-HML-001` a `005`) com empresas vinculadas sinalizadas com `is_teste = true`. O serviço [EnvironmentService.ts](src/services/environment/EnvironmentService.ts) garante que em modo de produção esses dados nunca sejam visíveis.
- **Referência:** [.agent/rules/homologacao-pipeline-clt.md](.agent/rules/homologacao-pipeline-clt.md).

### Decisão 05: Proteção Estrita de Credenciais Locais (Gate 03)
- **Contexto:** Existência de arquivos `env.json` e `env.txt` comitados no histórico do repositório.
- **Decisão:** Desrastrear do Git todos os arquivos de variáveis de ambiente (`git rm --cached`), proteger no `.gitignore` e padronizar o carregamento via `.env.local` não versionado.

---

## 3. Matriz de Estado dos Fluxos Operacionais

Para governança e transparência, os fluxos do ERP ORBE são classificados em quatro estados rigorosos:

| Fluxo / Funcionalidade | Estado Oficial | Descrição e Nível de Confiança |
| :--- | :---: | :--- |
| **Operações por Volume** | 🟢 **HOMOLOGADO** | Validado ponta a ponta com persistência e exibição no ERP desktop. |
| **Diaristas (Ciclo Semanal)** | 🟢 **HOMOLOGADO** | Grade de presença, cálculo de diária e geração de lote aprovados. |
| **Serviços Extras** | 🟢 **HOMOLOGADO** | Lançamento e integração com faturamento homologados. |
| **Custos Extras** | 🟢 **HOMOLOGADO** | Lançamento, reembolso e integração com DRE homologados. |
| **Portal do Encarregado** | 🟢 **HOMOLOGADO** (Rotas, Lançamentos, RLS)<br>🟡 **TESTADO INTERNAMENTE** (Auth Navegador)<br>🔴 **PENDENTE** (Validação Campo) | **Homologado:** Renderização das rotas operacionais, lançamentos dos quatro fluxos operacionais e controle de acesso RBAC/RLS (evidências do FIX-08).<br>**Testado Internamente:** Autenticação pelo navegador e funcionamento dos componentes `LoginOperacional` e `PortalGuard`.<br>**Pendente:** Validação operacional em dispositivos móveis reais, com encarregados em condições de campo. |
| **Dashboard Executivo & DRE** | 🟢 **HOMOLOGADO** | Consolidação financeira e auditoria de competência validadas. |
| **Motor RH (Ponto e Tolerâncias)** | 🟡 **TESTADO INTERNAMENTE** | Motor de cálculo implementado e testado com suíte de testes sintéticos. |
| **Remessas e Retornos CNAB 240** | 🟡 **TESTADO INTERNAMENTE** | Geradores e parsers validados com massas sintéticas locais (Itaú e BB). |
| **Homologação Bancária Externa** | 🔴 **PENDENTE** | **Não confundir testes internos com homologação bancária externa.** O envio e validação oficial de remessas junto aos gerentes bancários do Itaú e Banco do Brasil ainda não foram executados. |
| **Integração REP / TIO / n8n** | 🔴 **PENDENTE** | As Edge Functions e webhooks estão implementados, mas a esteira de sincronização diária em tempo real necessita de validação contínua em produção. |

---

## 4. Pendências Conhecidas e Dívidas Técnicas Mapeadas

1. **Credenciais no Histórico Antigo do Git:**
   - O saneamento executado no Gate 03 desrastreou `env.json`, `env.txt`, `env_dump.json` e `env_local_copy.txt` do índice de trabalho.
   - Contudo, **esses arquivos continuam gravados nos commits históricos passados** (`96ac06e`, `9b060b4`, `37f7ae1`, `8cc883b`, `f2e250a`). Como não houve reescrita do Git para evitar quebras de branches, caso o repositório seja tornado público, uma limpeza de histórico (via `git-filter-repo`) e rotação da chave Anon no Supabase serão mandatórias.
2. **Arquivos com Erro de Codificação UTF-8 (Mojibake Pré-existente):**
   - O script oficial `npm run check:encoding` falha em 5 arquivos legados:
     - `supabase/auditorias/sec_02_script_01_diagnostico_pre.sql` (mojibake em comentários SQL)
     - `scripts/fix_remessa.cjs` (codificação ANSI/Windows-1252)
     - `scripts/relatorio_validacao.txt` (codificação ANSI)
     - `scripts/resultado.txt` (codificação ANSI)
     - `scripts/test_db.cjs` (codificação ANSI)
   - Esses arquivos pertencem a etapas passadas e aguardam normalização segura de charset.
3. **Pasta `scratch/` Versionada no Git:**
   - Embora `scratch/` esteja no `.gitignore`, 1.674 arquivos da pasta foram comitados em momentos anteriores, incluindo 4 imagens oficiais de evidência de homologação (`scratch/evidence_*.png`).
   - Pendência: Mover as evidências para `docs/homologacao/evidencias/` e executar `git rm -r --cached scratch/`.
4. **Lockfiles Conflitantes:**
   - Presença de `bun.lock` e `bun.lockb` na raiz, enquanto o projeto utiliza oficialmente o `package-lock.json` do npm.
5. **Diretórios Redundantes:**
   - Pastas órfãs `database/rollbacks/` e `recovery/` que contêm rollbacks que pertencem oficialmente a `supabase/rollbacks/`.

---

## 5. Histórico dos Gates de Organização Concluídos

- **GATE ORGANIZAÇÃO 01 (Diagnóstico Geral):** Mapeamento completo dos 3.681 arquivos do repositório, identificação da arquitetura real e inventário dos 416 arquivos da raiz.
- **GATE ORGANIZAÇÃO 02 (Auditoria de Segurança):** Auditoria READ-ONLY dos arquivos de ambiente e verificação da exposição da chave Supabase Anon.
- **GATE ORGANIZAÇÃO 03 (Saneamento Controlado de Ambiente):** Desrastreamento de `env.json`, `env.txt`, `env_dump.json`, `env_local_copy.txt`, remoção de `env_check.mjs`, expansão do `.gitignore` e desacoplamento de scripts em `.agent/`.
- **GATE ORGANIZAÇÃO 04 (Documentação Mestre — Fase A & B):** Elaboração da tríade canônica de governança: [README.md](README.md), [CEREBRO.md](CEREBRO.md) e [MEMORIA.md](MEMORIA.md).

---

## 6. Procedimentos Oficiais de Manutenção e Validação

Antes de qualquer entrega ou proposta de alteração de código, executar obrigatoriamente:

```bash
# 1. Checagem estática de tipagem (0 erros tolerados)
npm run type-check

# 2. Compilação de produção (deve gerar dist/ com sucesso)
npm run build

# 3. Execução da suíte de testes
npm run test
```

> **Diretriz Final Inviolável:** A estabilidade da versão homologada `33fa738` é prioridade máxima. Toda nova funcionalidade deve ser adicionada via **extensão desacoplada**, jamais por alteração de contratos existentes.

