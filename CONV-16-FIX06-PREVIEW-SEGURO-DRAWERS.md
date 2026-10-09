# ERP ORBE — CONV-16 / FIX 06
# Relatório Técnico de Homologação: Pré-visualização Segura dos Drawers UI/UX

**Módulo:** Pessoas & RH → Diaristas  
**Rota Oficial de Produção:** `/operacional/diaristas`  
**Superfície Isolada de Homologação:** `/dev/diaristas-drawers`  
**Data:** 08/10/2026  
**Status:** ✅ Homologado com Sucesso  

---

## 1. Contexto e Diagnóstico

Na fase final de homologação do fluxo de Diaristas, os 3 Drawers contextuais (`Reabertura de Período`, `Edição Administrativa` e `Fechamento de Período`) foram implementados com seus acionadores funcionais integrados às regras de negócio e de governança.

Contudo, como a base de dados de homologação possuía apenas registros financeiramente liquidados (estados finais protegidos contra mutações), o usuário ficava impedido de inspecionar visualmente e interagir com os Drawers sem violar as travas do domínio financeiro ou criar mutações espúrias no banco de dados.

O **FIX 06** estabeleceu uma superfície de pré-visualização 100% isolada, reutilizando os componentes reais dos Drawers, utilizando fixtures em memória e aplicando travas absolutas contra qualquer operação de escrita, RPC ou alteração de estado no Supabase.

---

## 2. Superfície de Pré-visualização Criada

- **URL Local:**  
  `http://localhost:8080/dev/diaristas-drawers`
- **Condicionamento de Ambiente:**  
  Configurado estritamente sob `import.meta.env.DEV` em `src/App.tsx`.
  No build de produção (`vite build`), o bloco é eliminado via *dead code elimination* do compilador, tornando a rota inexistente em ambientes produtivos.
- **Isolamento de Navegação:**  
  - NENHUM link foi adicionado na Sidebar oficial do sistema.  
  - NENHUM botão ou acionador de teste foi adicionado à página oficial `/operacional/diaristas`.

---

## 3. Arquitetura e Componentes Reutilizados

Para garantir que a homologação visual seja fidedigna sem clonar código ou criar componentes fictícios paralelos, o JSX dos Drawers foi extraído modularmente para a camada compartilhada de Diaristas:

### 3.1 Componentes Extraídos (`src/components/diaristas/drawers/`)

1. **`DrawerReaberturaDiarista.tsx`**:
   - Encapsula o `DrawerPrimarioShell` com título, subtítulo, badge de governança e tagline.
   - Cards de diagnóstico com opções de modalidade (`Operacional` e `Administrativa`).
   - Card contextual com dados do lote selecionado.
   - Textarea com justificativa obrigatória de auditoria.
   - Botão "Cancelar" e Botão dinâmico ("Confirmar Reabertura Operacional" / "Confirmar Reabertura Administrativa").
   - Flag `isSimulation` para apresentar banner informativo no modo laboratório.

2. **`DrawerEdicaoDiarista.tsx`**:
   - Encapsula o `DrawerPrimarioShell` para ajustes autorizados em apontamentos.
   - Seleção de Código de Marcação (`P - 1.0`, `MP - 0.5`, `AUS - 0.0`) com recálculo automático em memória do valor.
   - Inputs numéricos de quantidade e valor diário base com card de resultado final calculado.
   - Validação mandatória da justificativa (mínimo de 5 caracteres).
   - Card informativo sobre snapshot e trilha de auditoria.

3. **`DrawerFechamentoDiarista.tsx`**:
   - Encapsula o `DrawerPrimarioShell` para consolidação do ciclo semanal e envio ao RH.
   - Resumo da consolidação (Empresa, Intervalo fechado, Contagem de apontamentos em aberto).
   - Alerta visual com consequências operacionais da trava de fechamento.
   - Input de observações opcionais do lote.
   - Trava de segurança textual crítica: exige a digitação exata da palavra `FECHAR` em maiúsculas para desbloquear o botão de confirmação.

4. **`StatusDiaristaBadge.tsx` & `types.ts`**:
   - Componente compartilhado e tabela de mapeamento de status de Diaristas.
   - Formatador padrão monetário `formatCurrency`.

---

## 4. Dados de Demonstração (Fixtures em Memória)

O ambiente `/dev/diaristas-drawers` é alimentado exclusivamente por constantes locais em memória:

| Cenário | Entidade | Fixture | Status Simulado | Elegibilidade |
|---|---|---|---|---|
| **Cenário A** | Reabertura de Período | `FIXTURE_LOTE_REABERTURA` (Lote `#lot-preview-hml-001`, ESC Logística, 14 apontamentos, R$ 1.960,00) | `AGUARDANDO_VALIDACAO_RH` | Elegível para devolução Operacional ou Administrativa |
| **Cenário B** | Edição Administrativa | `FIXTURE_LANCAMENTO_EDICAO` (Carlos Eduardo da Silva, Conferente, 07/10/2026, código `P`, R$ 140,00) | `EM_ABERTO` | Elegível para alteração cadastral e justificativa |
| **Cenário C** | Fechamento de Período | Período de 05/10/2026 a 11/10/2026, 8 apontamentos em aberto, ESC Logística | `EM_ABERTO` | Elegível para consolidação com envio para fila RH |

---

## 5. Garantia e Evidência de Bloqueio Absoluto de Mutações

Na rota `/dev/diaristas-drawers`:
- **Zero chamadas ao Supabase:** O arquivo `src/pages/Dev/DevDiaristasDrawersPreview.tsx` nem sequer importa o cliente `supabase` nem os serviços de persistência (`LancamentoDiaristaService`, `LoteFechamentoDiaristaService`, etc.).
- **Zero mutações de escrita:** Não existem chamadas a `.insert()`, `.update()`, `.delete()` ou `.rpc()`.
- **Callbacks locais em memória:** Os botões de confirmação nos 3 drawers disparam callbacks locais que:
  1. Registram o evento no console visual interativo da própria página (`Console de Interações Locais`);
  2. Disparam uma notificação toast do Sonner informando a validação bem-sucedida;
  3. Fecham o Drawer com animação suave;
  4. Nenhuma requisição de rede HTTP/WS de escrita é transmitida.
- **Botões Cancelar e X:** Operam normalmente fechando o drawer e limpando os formulários.

---

## 6. Arquivos Criados e Modificados

### 6.1 Novos Arquivos Criados
- `src/components/diaristas/drawers/types.ts`: Tipos e formatadores dos Drawers.
- `src/components/diaristas/drawers/StatusDiaristaBadge.tsx`: Badge oficial de status.
- `src/components/diaristas/drawers/DrawerReaberturaDiarista.tsx`: Componente modular do Drawer de Reabertura.
- `src/components/diaristas/drawers/DrawerEdicaoDiarista.tsx`: Componente modular do Drawer de Edição.
- `src/components/diaristas/drawers/DrawerFechamentoDiarista.tsx`: Componente modular do Drawer de Fechamento.
- `src/components/diaristas/drawers/index.ts`: Ponto de exportação unificado do módulo de Drawers.
- `src/pages/Dev/DevDiaristasDrawersPreview.tsx`: Superfície de homologação UI/UX com 3 cenários e in-memory log.
- `src/test/conv16_fix06_preview_drawers.test.tsx`: Suíte de testes unitários e de integração (8 testes).

### 6.2 Arquivos Modificados
- `src/pages/Rh/RhDiaristasPainel.tsx`: Substituição do JSX inline de mais de 480 linhas pela invocação dos 3 componentes modulares extraídos (`DrawerReaberturaDiarista`, `DrawerEdicaoDiarista`, `DrawerFechamentoDiarista`), preservando 100% do comportamento em produção.
- `src/App.tsx`: Registro da rota condicional `{import.meta.env.DEV && <Route path="/dev/diaristas-drawers" ... />}`.

---

## 7. Resultados dos Testes Automatizados

### 7.1 Suíte Vitest: `src/test/conv16_fix06_preview_drawers.test.tsx`
```text
✓ CONV-16 — FIX 06: Pré-visualização Segura dos Drawers para Homologação UI/UX
  1. DrawerReaberturaDiarista (Componente Real Modular)
    ✓ 1.1 Renderiza os dados de contexto do lote e valida estado desabilitado da confirmação
    ✓ 1.2 Permite alternar modalidade para Administrativa e confirma com motivo válido
  2. DrawerEdicaoDiarista (Componente Real Modular)
    ✓ 2.1 Renderiza os dados do colaborador e bloqueia confirmação com motivo menor que 5 caracteres
  3. DrawerFechamentoDiarista (Componente Real Modular)
    ✓ 3.1 Exige digitação exata da palavra "FECHAR" para autorizar a confirmação
  4. Ambiente de Pré-visualização Isolado (/dev/diaristas-drawers)
    ✓ 4.1 Renderiza a página DevDiaristasDrawersPreview com os 3 cards de cenários e banner de isolamento
    ✓ 4.2 Garante que DevDiaristasDrawersPreview NÃO possui chamadas diretas de escrita ao Supabase ou banco
    ✓ 4.3 Garante que a rota em App.tsx está condicionada estritamente a import.meta.env.DEV
    ✓ 4.4 Garante que RhDiaristasPainel.tsx utiliza os mesmos componentes extraídos

Test Files  1 passed (1)
     Tests  8 passed (8)
```

### 7.2 Regressão do FIX 05: `src/test/conv16_fix05_cabecalho_filtros.test.tsx`
```text
Test Files  1 passed (1)
     Tests  6 passed (6)
```

### 7.3 Verificação de Tipagem TypeScript (`npx tsc --noEmit`)
```text
Exit code: 0 (Zero erros em toda a árvore de arquivos)
```

### 7.4 Verificação HTTP do Dev Server Local
```text
GET http://localhost:8080/dev/diaristas-drawers
StatusCode: 200 OK
```

---

## 8. Como Executar a Homologação Manual

1. Acesse no navegador local:
   ```text
   http://localhost:8080/dev/diaristas-drawers
   ```
2. **Cenário A — Reabertura de Período:**
   - Clique em **"Abrir Drawer Reabertura"**;
   - Alterne entre modalidade **Operacional** e **Administrativa**;
   - Observe o aviso de modo restrito e a trava no botão de confirmação;
   - Preencha o motivo da reabertura e clique em **"Confirmar Reabertura"**;
   - Verifique o fechamento do drawer e o registro no **Console de Interações Locais**.
3. **Cenário B — Edição Administrativa:**
   - Clique em **"Abrir Drawer Edição"**;
   - Altere o código de marcação (ex: de `P` para `MP` ou altere a quantidade);
   - Observe o recálculo do valor final em tempo real;
   - Digite um motivo menor que 5 caracteres e veja o botão desabilitado;
   - Complete a justificativa e confirme a alteração;
   - Verifique o fechamento e o registro do snapshot no console em memória.
4. **Cenário C — Fechamento de Período:**
   - Clique em **"Abrir Drawer Fechamento"**;
   - Observe o botão **"Confirmar e Fechar"** bloqueado;
   - Digite qualquer palavra diferente no campo (o botão permanece bloqueado);
   - Digite `FECHAR`;
   - Clique no botão habilitado e verifique o fechamento e a notificação de simulação.
