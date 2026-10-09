# ERP ORBE — CONV-16 / FIX 04
## DESCOBERTA DE AÇÕES, AJUDA CONTEXTUAL E HOMOLOGAÇÃO DOS DRAWERS

**Módulo:** Pessoas & RH → Diaristas  
**Rota Oficial:** `/operacional/diaristas`  
**Arquivo Modificado:** `src/pages/Rh/RhDiaristasPainel.tsx`  
**Novo Arquivo de Teste:** `src/test/conv16_fix04_descoberta_acoes_drawers.test.tsx`  
**Referências:** `CONV-16-FIX03-AUDITORIA-ACIONADORES-DRAWERS.md` e `CONV-16-ETAPA02B-DRAWERS-CONTEXTUAIS.md`  
**Data:** 08/10/2026  
**Classificação:** Refinamento UI/UX, Acessibilidade e Governança Funcional  

---

## 1. COMPONENTES REUTILIZADOS & PADRÃO OFICIAL DO ORBE

Em estrito cumprimento à diretriz de **preservação do Design System oficial do ORBE**:
- **Biblioteca de Tooltip:** Reutilizado exclusivamente o componente nativo do ORBE:  
  `@/components/ui/tooltip` (`Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`). Nenhuma biblioteca adicional foi instalada.
- **Acessibilidade:** Implementado container `<span tabIndex={0} className="inline-flex cursor-not-allowed">` como wrapper de botões `disabled`, permitindo que os Tooltips disparem perfeitamente tanto por mouse hover quanto por navegação de teclado (Tab/Focus) e dispositivos touch, sem bloquear eventos e sem permitir cliques ou mutações acidentais.
- **Identidade Visual:** Mantidas as cores institucionais (Azul `#2563EB`, Âmbar `#D97706`/`bg-amber-600`, Canvas `#F8FAFC`, bordas `#E2E8F0`), os 4 KPIs executivos, as 4 abas padronizadas, densidade compacta e ausência de elementos decorativos supérfluos.
- **Drawers:** Preservado o componente oficial `DrawerPrimarioShell` em sua integridade funcional e estrutural.

---

## 2. ARQUIVOS MODIFICADOS & CRIADOS

1. **`src/pages/Rh/RhDiaristasPainel.tsx`**:
   - Import dos componentes de Tooltip oficial (`@/components/ui/tooltip`).
   - Refatoração do botão **"Fechar Período"** no cabeçalho de filtros: mantido continuamente visível para perfis autorizados (`isAdmin || isRh`), desabilitado com Tooltip contextual quando houver impedimento real (`rawEmAberto === 0` ou `periodoBloqueado`).
   - Refatoração do botão **"Reabrir"** na coluna Ações da tabela de Lotes (Aba *"Lotes & Ciclos"*): mantido visível para perfis autorizados, com estado desabilitado e Tooltip contextual quando o lote estiver em status `PAGO` ou em remessa/processamento financeiro.
   - Refatoração da ação de **"Edição Administrativa"** na tabela expandida da Aba *"Por Diarista"*: preservado o botão no padrão da tabela (`variant="ghost"`, ícone `<Settings />`), com estado desabilitado e Tooltip contextual (`"Edição indisponível: registro pertencente a lote pago."`) quando o registro for liquidado.
   - Segregação estrita de permissões mantida: perfis sem autorização (`!isAdmin && !isRh`) continuam sem visualizar as ações administrativas de governança.

2. **`src/test/conv16_fix04_descoberta_acoes_drawers.test.tsx`**:
   - Criação da suíte oficial com 5 testes automatizados cobrindo a reutilização dos tooltips, condições de habilitação, detecção de impedimentos, acessibilidade de teclado e cancelamento seguro dos Drawers.

---

## 3. MATRIZ DE VISIBILIDADE, HABILITAÇÃO E MENSAGENS CONTEXTUAIS

| Ação / Drawer | Localização na UI | Visibilidade para Autorizados | Visibilidade para Não Autorizados | Condição de Habilitação | Estado no Cenário Real (Lote Pago / 0 Abertos) | Mensagem Contextual Implementada (Tooltip) | Próxima Ação Informada |
|---|---|---|---|---|---|---|---|
| **A. Fechar Período** | Cabeçalho de Filtros | ✅ **Sempre Visível** | ❌ Oculto (Segregação de Perfil) | `rawEmAberto > 0 && !periodoBloqueado` | **Desabilitado** | *"Fechamento indisponível: não existem apontamentos em aberto para este período. (Ajuste os filtros ativos para verificar registros.)"* ou *"Fechamento indisponível: este período já possui lote homologado ou em processamento financeiro."* | Se `periodoBloqueado`: consultar na aba *"Lotes & Ciclos"*. Se 0 abertos: novos lançamentos na Grade Semanal. |
| **B. Reabrir Período** | Aba *"Lotes & Ciclos"* → Tabela de Lotes → Coluna Ações | ✅ **Sempre Visível** | ❌ Oculto (Segregação de Perfil) | `["AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH"].includes(lote.status)` e dentro dos limites de ciclo | **Desabilitado** | Se `PAGO`: *"Reabertura indisponível: lote liquidado financeiramente."*<br>Se em remessa/processamento: *"Reabertura indisponível: lote em processamento ou remessa bancária."* | Lotes liquidados são imutáveis; rastreabilidade na Conciliação Bancária. |
| **C. Edição Administrativa** | Aba *"Por Diarista"* → Expansão do Diarista → Coluna Ação | ✅ **Sempre Visível** (no padrão da tabela) | ❌ Oculto (Segregação de Perfil) | `!isPago` | **Desabilitado** (ícone `<Settings />` atenuado) | *"Edição indisponível: registro pertencente a lote pago."* | Registros pagos são bloqueados pela governança financeira. |

---

## 4. VERIFICAÇÃO DE SEGREGAÇÃO DE PERMISSÕES

Em consonância com as regras de governança do ERP ORBE:
- A verificação de permissão (`isAdmin || isRh`) é avaliada antes de qualquer renderização de ação.
- **Perfis Não Autorizados:**
  - O botão de Fechamento não é renderizado no cabeçalho.
  - O botão de Reabertura não é renderizado na tabela de lotes.
  - O botão de Edição Administrativa não é renderizado na lista de apontamentos.
  - A ausência de permissão **não é mascarada como mera desabilitação visual**; ela remove a capacidade operacional do DOM para perfis não autorizados.
- **Perfis Autorizados:**
  - As ações aparecem de forma previsível e estável nos locais homologados.
  - Impedimentos de regra de negócio (ex: status liquidado, ausência de dados pendentes) são claramente comunicados via Tooltip, sem quebrar o layout.

---

## 5. TESTES AUTOMATIZADOS EXECUTADOS

### 5.1 Verificação de Tipos TypeScript
```bash
npx tsc --noEmit
# Saída: Código 0 (Zero erros, 100% íntegro)
```

### 5.2 Suíte de Testes Vitest
Executados os testes de componentes e contratos dos Drawers:
```bash
npx vitest run src/test/conv16_fix04_descoberta_acoes_drawers.test.tsx src/test/conv16_etapa02b_drawers_contextuais.test.tsx
```
**Resultado:**
```text
 ✓ src/test/conv16_fix04_descoberta_acoes_drawers.test.tsx (5 tests)
   ✓ 1. Reutiliza o componente oficial de Tooltip (@/components/ui/tooltip) sem bibliotecas externas
   ✓ 2. Fechamento de período: exibição no local previsto para autorizados, Tooltip padronizado com impedimento real e bloqueio
   ✓ 3. Reabertura de período: preservação da coluna Ações, exibição desabilitada com Tooltip contextual para lote pago ou em remessa
   ✓ 4. Edição administrativa: preserva o botão na tabela para autorizados, estado desabilitado com Tooltip quando pago
   ✓ 5. Preserva integralmente os 3 Drawers e seus contratos de cancelamento limpo sem mutação
 ✓ src/test/conv16_etapa02b_drawers_contextuais.test.tsx (6 tests)
   ✓ 1. Implementa DrawerPrimarioShell oficial da camada de continuidade
   ✓ 2. Drawer de Reabertura: contexto, modalidades, justificativa obrigatória e mutação segura
   ✓ 3. Drawer de Edição Administrativa: snapshot, campos, recálculo seguro e justificativa de auditoria
   ✓ 4. Drawer de Fechamento: confirmação textual "FECHAR", bloqueios e envio para RH
   ✓ 5. PEND-03: Orientação contextual e bloqueio de engrenagem para lotes liquidados ou usuários sem permissão
   ✓ 6. Garante que as mutations de negócio e contratos de serviço foram 100% preservados

 Test Files  2 passed (2)
      Tests  11 passed (11)
```

---

## 6. LIMITAÇÕES DE AMBIENTE & HOMOLOGAÇÃO DE DADOS

Conforme as restrições estritas do projeto:
1. **Ambiente com Base Real:** A base conectada possui dados operacionais reais e registros financeiros já liquidados (Lote `1bf3f73c...` em status `PAGO`).
2. **Vedação de Mutações Falsas:** Em conformidade com a instrução:
   > *"Antes de qualquer preparação de dados, confirmar que o ambiente não aponta para produção. Não utilizar scripts que selecionem automaticamente o primeiro tenant da base. Não modificar registros financeiros reais. Se não existir ambiente seguro disponível, não criar dados e registrar a homologação como pendente."*
   Não foram criados nem forçados dados fictícios de mutação na base real.
3. **Falha Externa no Driver do Navegador:** A ferramenta `browser_subagent` reportou falha na inicialização do Playwright decorrente de erro HTTP 404 no download do executável da Microsoft (`https://playwright.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip`), impedindo a gravação de capturas pelo subagente automático.
4. **Classificação Regimental:** Em cumprimento à regra:
   > *"Não declarar homologação visual sem capturas reais."*
   A verificação visual via capturas automáticas do subagente e o teste com mutações reais são classificados como **PENDENTES DE AMBIENTE DE HOMOLOGAÇÃO ISOLADO**.

---

## 7. VEREDITO TÉCNICO

| Critério | Avaliação | Evidência |
|---|---|---|
| Reutilização do Design System ORBE | ✅ **APROVADO** | Uso exclusivo de `@/components/ui/tooltip` e `DrawerPrimarioShell` |
| Resolução do Problema de Descoberta | ✅ **APROVADO** | Os 3 botões são mantidos continuamente nos locais previstos com tooltips de impedimento |
| Acessibilidade de Teclado e Touch | ✅ **APROVADO** | Wrapper `tabIndex={0}` em botões desabilitados |
| Segregação e Segurança de Perfis | ✅ **APROVADO** | Não autorizados não visualizam ações de governança |
| Ausência de Regressão em Tipos e Código | ✅ **APROVADO** | `npx tsc --noEmit` zerado |
| Testes Automatizados Unitários / Contratos | ✅ **APROVADO** | 11/11 testes aprovados no Vitest |
| Homologação com Mutações e Capturas Reais | ⏳ **PENDENTE** | Aguardando base isolada e correção do driver externo de browser |

---

## 8. ENCERRAMENTO

A implementação do **FIX 04** foi concluída com sucesso no código-fonte e validada por testes automatizados. A interface agora comunica com absoluta clareza os estados, os impedimentos e as próximas ações, sem mascarar regras de negócio e sem comprometer a governança financeira do ORBE.

Em estrito cumprimento às instruções da tarefa:
- Nenhuma outra etapa foi iniciada.
- Nenhum commit de congelamento foi criado.
- A execução encontra-se interrompida e aguarda orientações do usuário.
