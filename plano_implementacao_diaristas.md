# Plano de Implementação — Módulo Diaristas
**ERP Orbe · Versão 1.0 · Maio 2026**

---

## Visão Geral

O Módulo Diaristas substitui a aba **DIARISTAS** da planilha `01 JANEIRO.xlsx` e implementa um fluxo completo de:

1. **Cadastro pelo RH** → quem são os diaristas, funções e valores
2. **Lançamento pelo Encarregado (Carlos)** → marcação diária de presença (P / MP / Ausente)
3. **Consolidação pelo RH** → painel tipo planilha, fechamento e exportação quinzenária

O preset `preset_diaristas` já existe em `LancamentoProducao.tsx`, mas o módulo dedicado ainda não foi construído.

---

## Contexto Atual do Projeto

| Elemento | Status |
|---|---|
| Preset `preset_diaristas` em `LancamentoProducao.tsx` | ✅ Existe |
| Rota `/producao/diaristas` | ❌ Não existe |
| Rota `/rh/diaristas` | ❌ Não existe |
| Tabela `diaristas` no banco | ❌ Não existe |
| Tabela `lancamentos_diaristas` no banco | ❌ Não existe |
| Perfil `encarregado_diaristas` no banco | ❌ Não existe |
| Controle de visibilidade de cards por perfil | ❌ Não existe |

---

## Estrutura de Dados

### 1. Tabela `diaristas` (cadastro base — gerenciado pelo RH)

```sql
CREATE TABLE public.diaristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  funcao TEXT NOT NULL DEFAULT 'Diarista',
  -- Funções possíveis: Diarista | Auxiliar de carga | Ajudante | Conferente 
  -- | Operador eventual | Serviço extra
  valor_diaria NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- RLS: empresa_id obrigatório em todas as queries
ALTER TABLE public.diaristas ENABLE ROW LEVEL SECURITY;
```

### 2. Tabela `lancamentos_diaristas` (lançamentos diários operacionais)

```sql
CREATE TABLE public.lancamentos_diaristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  diarista_id UUID NOT NULL REFERENCES public.diaristas(id),
  nome_colaborador TEXT NOT NULL,
  cpf_colaborador TEXT,
  funcao_colaborador TEXT,
  data_lancamento DATE NOT NULL,
  tipo_lancamento TEXT NOT NULL DEFAULT 'diarista',
  codigo_marcacao TEXT NOT NULL CHECK (codigo_marcacao IN ('P', 'MP')),
  -- P = diária completa / MP = meia diária
  quantidade_diaria NUMERIC(3,1) NOT NULL CHECK (quantidade_diaria IN (1, 0.5)),
  valor_diaria_base NUMERIC(10,2) NOT NULL,
  valor_calculado NUMERIC(10,2) NOT NULL,
  -- valor_calculado = valor_diaria_base * quantidade_diaria
  cliente_unidade TEXT,
  operacao_servico TEXT,
  encarregado_id UUID REFERENCES auth.users(id),
  encarregado_nome TEXT,
  status TEXT NOT NULL DEFAULT 'em_aberto'
    CHECK (status IN ('em_aberto', 'fechado_para_pagamento', 'pago', 'cancelado')),
  lote_fechamento_id UUID,
  -- Referência ao lote gerado no fechamento de período
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lancamentos_diaristas ENABLE ROW LEVEL SECURITY;
```

### 3. Tabela `lotes_fechamento_diaristas` (controle de fechamento)

```sql
CREATE TABLE public.lotes_fechamento_diaristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  total_registros INT,
  valor_total NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'fechado'
    CHECK (status IN ('fechado', 'pago', 'cancelado')),
  fechado_por UUID REFERENCES auth.users(id),
  fechado_em TIMESTAMPTZ DEFAULT now(),
  observacoes TEXT
);

ALTER TABLE public.lotes_fechamento_diaristas ENABLE ROW LEVEL SECURITY;
```

### 4. Perfil `encarregado_diaristas`

Inserir na tabela `perfis`:

```sql
INSERT INTO public.perfis (nome, descricao)
VALUES ('encarregado_diaristas', 'Acesso restrito ao lançamento de diaristas');
```

---

## Regra de Marcação e Cálculo

```
P  → quantidade_diaria = 1.0 → valor_calculado = valor_diaria_base * 1.0
MP → quantidade_diaria = 0.5 → valor_calculado = valor_diaria_base * 0.5
Ausente → não gera registro (ou cria com valor 0, ignorado no consolidado)
```

---

## Status Automático

```
Se status != 'recebido' E hoje > data_vencimento:
  → status = 'atrasado'
```

---

## Arquitetura de Rotas

```
/producao                     → LancamentoProducao.tsx (já existe)
  └─ /producao/diaristas      → [NOVO] DiaristasLancamento.tsx

/rh/diaristas                 → [NOVO] RhDiaristasPainel.tsx
/rh/diaristas/cadastros       → [NOVO] RhDiaristasGestao.tsx
```

---

## Controle de Acesso por Perfil

### Comportamento da tela `/producao` para `encarregado_diaristas`

- Card **Diaristas** → ativo e clicável
- Cards `Descarga pgto. imediato`, `Descarga corporativa`, `Operações com a DISMELO`, `Transbordo e Serviço Extra`, `Custos CLT` → **desabilitados** visualmente (opacidade reduzida)
- Ao clicar em card bloqueado: exibir toast `"Você não tem permissão para acessar este lançamento."`

### Implementação sugerida em `LancamentoProducao.tsx`

```ts
const PRESETS_PERMITIDOS_POR_PERFIL: Record<string, string[]> = {
  encarregado_diaristas: ['preset_diaristas'],
  // Admin e outros: sem restrição (array vazio = todos liberados)
};

const perfilNome = perfil?.perfis?.nome ?? '';
const listaBloqueada = PRESETS_PERMITIDOS_POR_PERFIL[perfilNome] ?? [];
const presetBloqueado = (presetId: string) =>
  listaBloqueada.length > 0 && !listaBloqueada.includes(presetId);
```

---

## Componentes a Criar ou Modificar

### ① `src/pages/LancamentoProducao.tsx` — MODIFICAR

> Adicionar lógica de bloqueio de cards por perfil e redirecionar clique em "Diaristas" para `/producao/diaristas`.

**Mudanças:**
- Detectar perfil `encarregado_diaristas`
- Desabilitar cards bloqueados: visual opaco + tooltip de acesso negado
- Ao clicar em `preset_diaristas`, navegar para `/producao/diaristas` (ou manter fluxo atual com guard)

---

### ② `src/pages/Producao/DiaristasLancamento.tsx` — NOVO

> Tela operacional de lançamento diário. Usada pelo Carlos.

**Etapa 1 — Dados do Lançamento:**
- Data do lançamento (default hoje)
- Cliente/Unidade (select)
- Operação/Serviço (texto livre)
- Encarregado responsável (preenchido automaticamente com nome do usuário logado)
- Observações gerais

**Etapa 2 — Lista de Presença:**
- Carrega diaristas ativos da `empresa_id` do usuário logado
- Cada linha: Nome | Função | Valor | Botões [Ausente] [P] [MP] | Campo observação | Valor gerado
- Cálculo automático: `P → valor_diaria`, `MP → valor_diaria / 2`, `Ausente → R$ 0,00`

**Resumo em tempo real (rodapé/lateral):**
- Total diaristas, total presentes, total meias diárias, total ausentes, valor total

**Salvar:** gera registros individuais em `lancamentos_diaristas` apenas para P e MP.

---

### ③ `src/pages/Rh/RhDiaristasPainel.tsx` — NOVO

> Painel de consolidação do RH, formato planilha.

**Colunas:**
- Diarista | Função | Dias do período (colunas dinâmicas) | Qtd P | Qtd MP | Total diárias eq. | Valor total | Status | Ações

**Filtros:**
- Período, Nome, Função, Status, Cliente/Unidade, Encarregado

**Ao clicar em diarista:** Drawer/modal com histórico detalhado.

**Ação principal:** Fechar período → seleciona intervalo → gera `lote_fechamento_diaristas` → altera status dos registros para `fechado_para_pagamento`.

**Exportação:** Planilha quinzenária após fechamento (xlsx via `xlsx` ou `papaparse`).

---

### ④ `src/pages/Rh/RhDiaristasGestao.tsx` — NOVO

> CRUD de diaristas gerenciado pelo RH.

**Campos:** Nome completo, CPF, Telefone, Função (select), Valor da diária, Status, Empresa, Observações.

**Ações disponíveis para RH:**
- Cadastrar, editar função, alterar valor, ativar/inativar, consultar histórico

**Ações bloqueadas para Carlos:**
- Nenhuma — esta tela não é acessível ao perfil `encarregado_diaristas`

---

### ⑤ `src/services/base.service.ts` — MODIFICAR

Adicionar services:

```ts
DiaristaService.getByEmpresa(empresa_id)
DiaristaService.create(payload)
DiaristaService.update(id, payload)
DiaristaService.softDelete(id)

LancamentoDiaristaService.getByPeriodo(empresa_id, inicio, fim)
LancamentoDiaristaService.createBatch(registros[])
LancamentoDiaristaService.fecharPeriodo(empresa_id, inicio, fim, fechado_por)
LancamentoDiaristaService.exportarParaXlsx(lote_id)
```

---

### ⑥ `src/App.tsx` — MODIFICAR

Adicionar rotas:

```tsx
<Route path="/producao/diaristas" element={<AuthGuard><DiaristasLancamento /></AuthGuard>} />
<Route path="/rh/diaristas" element={<AuthGuard><RhDiaristasPainel /></AuthGuard>} />
<Route path="/rh/diaristas/cadastros" element={<AuthGuard><RhDiaristasGestao /></AuthGuard>} />
```

---

## RLS — Políticas de Acesso

```sql
-- Diaristas: leitura por empresa, escrita apenas pelo RH e Admin
CREATE POLICY "diaristas_select" ON public.diaristas
  FOR SELECT USING (empresa_id = (
    SELECT empresa_id FROM public.perfis_usuarios WHERE user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "diaristas_insert_update" ON public.diaristas
  FOR ALL USING (
    get_user_role() IN ('Admin', 'RH')
  );

-- Lancamentos: leitura por empresa, insert pelo encarregado
CREATE POLICY "lancamentos_diaristas_select" ON public.lancamentos_diaristas
  FOR SELECT USING (empresa_id = (
    SELECT empresa_id FROM public.perfis_usuarios WHERE user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "lancamentos_diaristas_insert" ON public.lancamentos_diaristas
  FOR INSERT WITH CHECK (
    get_user_role() IN ('Admin', 'RH', 'Encarregado')
    OR EXISTS (
      SELECT 1 FROM public.perfis_usuarios pu
      JOIN public.perfis p ON p.id = pu.perfil_id
      WHERE pu.user_id = auth.uid()
        AND p.nome = 'encarregado_diaristas'
    )
  );
```

---

## Fluxo Completo Esperado

```
Admin cadastra Carlos com perfil encarregado_diaristas
        ↓
RH acessa /rh/diaristas/cadastros
        ↓
RH cadastra diaristas com função e valor da diária
        ↓
Carlos acessa /producao → vê apenas o card "Diaristas" ativo
        ↓
Carlos abre /producao/diaristas
        ↓
Sistema carrega diaristas ativos da empresa do Carlos
        ↓
Carlos marca P, MP ou Ausente para cada diarista
        ↓
ERP calcula valores automaticamente
        ↓
Carlos salva → registros criados em "em_aberto"
        ↓
RH acessa /rh/diaristas e acompanha em formato planilha
        ↓
RH clica em diarista → detalha dias individuais
        ↓
RH seleciona período e clica "Fechar período para pagamento"
        ↓
ERP gera lote e muda status → fechado_para_pagamento
        ↓
RH exporta planilha quinzenária (xlsx)
```

---

## Ordem de Implementação Sugerida

| Fase | O que fazer | Prioridade |
|---|---|---|
| 1 | Migrations do banco (`diaristas`, `lancamentos_diaristas`, `lotes_fechamento_diaristas`, perfil) | 🔴 Alta |
| 2 | Services no `base.service.ts` | 🔴 Alta |
| 3 | Tela `RhDiaristasGestao.tsx` (CRUD de diaristas) | 🟡 Média |
| 4 | Tela `DiaristasLancamento.tsx` (lançamento pelo Carlos) | 🔴 Alta |
| 5 | Modificar `LancamentoProducao.tsx` (bloqueio de cards por perfil) | 🟡 Média |
| 6 | Tela `RhDiaristasPainel.tsx` (painel + fechamento + exportação) | 🟡 Média |
| 7 | Rotas no `App.tsx` | 🔴 Alta |
| 8 | RLS políticas no Supabase | 🔴 Alta |

---

## Plano de Verificação

### Testes Manuais

1. **Acesso por perfil:**
   - Criar usuário com perfil `encarregado_diaristas`
   - Acessar `/producao` → verificar que apenas Diaristas está ativo
   - Clicar em card bloqueado → verificar mensagem de acesso negado

2. **Carregamento dos diaristas:**
   - Cadastrar 2+ diaristas via `/rh/diaristas/cadastros`
   - Acessar `/producao/diaristas` → verificar que lista carrega corretamente

3. **Lançamento e cálculo:**
   - Marcar P em um diarista com valor R$ 120,00 → verificar R$ 120,00
   - Marcar MP no mesmo → verificar R$ 60,00
   - Verificar resumo em tempo real no rodapé

4. **Salvamento:**
   - Clicar em Salvar → verificar registros em `lancamentos_diaristas` no Supabase
   - Verificar que ausentes não geram registro (ou geram com valor 0)

5. **Painel do RH:**
   - Acessar `/rh/diaristas` → verificar tabela no formato planilha
   - Aplicar filtros → verificar reatividade

6. **Fechamento:**
   - Fechar período → verificar geração de `lotes_fechamento_diaristas`
   - Verificar mudança de status dos registros para `fechado_para_pagamento`

7. **Exportação:**
   - Após fechar, clicar em exportar → verificar geração de arquivo xlsx

### Checklist de Estabilidade (ProjectStabilizerSkill)

- [ ] Tela de lançamento funciona sem diaristas cadastrados (estado vazio)
- [ ] Tela do RH funciona sem lançamentos (estado vazio)
- [ ] Formulário de lançamento não permite submit sem data ou cliente
- [ ] Cards bloqueados não quebram interface ao clicar
- [ ] Queries respeitam `empresa_id` em todos os endpoints
- [ ] Nenhum dado de diarista vaza entre empresas (RLS)
- [ ] Status automático de atraso funciona corretamente
