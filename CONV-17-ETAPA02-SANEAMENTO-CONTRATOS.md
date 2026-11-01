# ERP ORBE — CONV-17 / ETAPA 02
## Saneamento de Contratos e Navegação — Intermitentes

**Projeto:** ERP ESC Logística 2026  
**Domínio:** Pessoas & RH → Intermitentes / Financeiro → Central Bancária  
**Agente executor:** Antigravity  
**Status da Etapa:** Concluída (Auditoria Aprofundada & Diagnóstico Delimitado — Aguardando Autorização para Aplicação de Correções de Domínio/Segurança)  
**Data:** 09/10/2026  

---

## 1. RESUMO EXECUTIVO

Em conformidade estrita com as diretrizes da **ETAPA 02**, foi realizada a investigação aprofundada dos 3 blocos críticos identificados na ETAPA 01:
1. **BLOCO A — Contrato CNAB:** Investigação da chamada a `gerarRemessaCNAB` em `CentralBancariaDrawerOficial.tsx` versus a API canônica de `IntermitentesLoteService`.
2. **BLOCO B — Navegação para Central Bancária:** Auditoria do link `/bancario?tab=intermitentes&origem=INTERMITENTE` originado em `IntermitentesLotes.tsx` versus os parâmetros suportados por `CentralBancaria.tsx`.
3. **BLOCO C — Permissões e Rotas:** Auditoria de `AuthGuard`, `ROUTE_ACCESS_RULES` e matriz RBAC para os 5 endpoints de Intermitentes.
4. **BLOCO D — Regressão:** Criação da suíte unitária `src/test/conv17_etapa02_saneamento_contratos.test.ts` (11 testes automatizados) e execução de `npx tsc --noEmit`.

**Regra de Ouro Obedecida:** Nenhuma substituição nominal ou alteração de contrato de domínio foi realizada sem autorização prévia. O presente documento formaliza a causa raiz, os impactos e as propostas técnicas recomendadas para homologação.

---

## 2. BLOCO A — AUDITORIA DE CONTRATO CNAB (PRIORIDADE CRÍTICA)

### 2.1 Confirmação da Inexistência de `gerarRemessaCNAB`
- **Diagnóstico:** O método `gerarRemessaCNAB` é **completamente inexistente em tempo de execução** tanto na classe `IntermitentesLoteServiceClass` (`src/services/domain/intermitentes.service.ts`) quanto na classe `LoteFechamentoDiaristaServiceClass` (`src/services/domain/diaristas.service.ts`).
- **Ponto de Quebra em Produção:** Em `src/components/bancario/CentralBancariaDrawerOficial.tsx` (linhas 193 e 199):
  ```typescript
  // Linha 193 (Diaristas):
  await LoteFechamentoDiaristaService.gerarRemessaCNAB(item.loteId, { ... });
  // Linha 199 (Intermitentes):
  await IntermitentesLoteService.gerarRemessaCNAB(item.loteId, { ... });
  ```
  Se acionadas pelo operador no Drawer da Central Bancária, essas linhas lançam:
  `TypeError: IntermitentesLoteService.gerarRemessaCNAB is not a function`.
- **Causa Raiz:** O teste de regressão herdado da CONV-11 (`conv11_central_bancaria.test.tsx`, linha 261) realizou apenas uma validação textual do arquivo-fonte (`expect(drawerContent).toContain("IntermitentesLoteService.gerarRemessaCNAB")`), mascarando a ausência do método na instância do serviço.

### 2.2 Implementação e Argumentos do Método Canônico `gerarCNABParaLote`
O método oficial já implementado e homologado em `IntermitentesLoteService` é:
```typescript
async gerarCNABParaLote(params: {
  loteId: string;
  empresaId: string;
  geradoPor: string;
  geradoPorNome: string;
  empresaRemetente: {
    cnpj: string;
    razao_social: string;
    banco_codigo: string;
    agencia: string;
    agencia_digito?: string;
    conta: string;
    digito_conta?: string;
    convenio_bancario?: string;
    codigo_empresa_banco?: string;
    nome_empresa_banco?: string;
  };
}): Promise<{ nomeArquivo: string; totalRegistros: number; valorTotal: number }>
```

### 2.3 Rastreamento do Fluxo Canônico e Validações de Segurança
O fluxo canônico dentro de `gerarCNABParaLote` executa as seguintes travas em arquitetura *fail-closed*:
1. **Validação de Status do Lote:** Exige obrigatoriamente que o lote esteja com status `FECHADO_FINANCEIRO` ou `AGUARDANDO_PAGAMENTO`. Lotes em `VALIDADO_RH`, `AGUARDANDO_VALIDACAO_RH` ou `DEVOLVIDO` são estritamente rejeitados com erro explícito.
2. **Validação de Lançamentos:** Busca registros vinculados em `lancamentos_intermitentes`. Lançamentos órfãos ou vazios bloqueiam a operação.
3. **Auditoria de Beneficiários e Favorecidos:** Agrupa valores por intermitente e audita a completude cadastral bancária em `colaboradores` (`banco_codigo`, `agencia`, `conta`, `digito_conta`, CPF válido com 11 dígitos, valor estritamente positivo).
4. **Resolução da Empresa Pagadora:** Busca dados em `contas_bancarias_empresa` (`ativo = true`, conferindo banco, agência e conta com `empresaRemetente`).
5. **Auditoria Fiscal da Pagadora:** Valida CNPJ/CPF da empresa pagadora via rotina canônica `validarEmpresaPagadora`.
6. **Motor Posicional FEBRABAN CNAB240:** Gera os segmentos de lote Header, Segmento A (Transferência/PIX), e Trailer.
7. **Persistência e Rastreabilidade:** Grava em `cnab_remessas_arquivos` e `cnab_remessas_itens`, registra em `audit_logs` e promove o lote para `CNAB_GERADO`.

### 2.4 Segregação de Perfil, Tenant, Empresa e Ambiente
- **Tenant:** Segregado por RLS e resolvido via `getCurrentTenantId()`.
- **Empresa:** Validação cruzada impedindo que conta pagadora de uma empresa seja associada a lote de outra (`item.contaPagadora.empresaId === item.empresaId`).
- **Ambiente:** `EnvironmentService` e `isEmpresaTeste` bloqueiam cruzamento entre bases de Produção e Homologação.
- **Perfil:** Acesso restrito a usuários com permissão do módulo `pagamentos_remessas` (Financeiro / Gestor / Admin).

### 2.5 Proposta Técnica para Saneamento do BLOCO A (Aguardando Autorização)
Para sanar o contrato sem causar regressão nem quebrar o teste `conv11_central_bancaria.test.tsx` linha 261, propõe-se a seguinte abordagem:

#### **Opção Recomendada: Fachada no Domínio (Adapter Pattern)**
Adicionar o método de fachada em `IntermitentesLoteServiceClass` (e similarmente em `LoteFechamentoDiaristaServiceClass`):
```typescript
async gerarRemessaCNAB(loteId: string, options: { bancoRemessa: string; contaBancariaId: string }) {
  // 1. Busca os dados do lote para obter empresa_id
  const { data: lote, error: loteErr } = await this.supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, empresa_id, status')
    .eq('id', loteId)
    .single();
  if (loteErr || !lote) throw new Error('Lote não encontrado.');

  // 2. Busca conta bancária pagadora selecionada
  const { data: contaData, error: contaErr } = await this.supabase
    .from('contas_bancarias_empresa')
    .select('*')
    .eq('id', options.contaBancariaId)
    .single();
  if (contaErr || !contaData) throw new Error('Conta bancária pagadora não encontrada.');

  // 3. Obtém dados do usuário autenticado atual
  const { data: authData } = await this.supabase.auth.getUser();

  // 4. Delega para o motor canônico existente
  return this.gerarCNABParaLote({
    loteId,
    empresaId: lote.empresa_id,
    geradoPor: authData?.user?.id || 'sistema',
    geradoPorNome: authData?.user?.email || 'Financeiro',
    empresaRemetente: {
      cnpj: contaData.cedente_cnpj || '',
      razao_social: contaData.cedente_nome || '',
      banco_codigo: contaData.banco_codigo,
      agencia: contaData.agencia,
      agencia_digito: contaData.agencia_digito || ' ',
      conta: contaData.conta,
      digito_conta: contaData.conta_digito || ' ',
      convenio_bancario: contaData.convenio || undefined,
    }
  });
}
```
**Vantagens:**
- Mantém o contrato esperado por `CentralBancariaDrawerOficial.tsx`.
- Mantém válida a asserção de CONV-11 em `conv11_central_bancaria.test.tsx`.
- Reutiliza 100% da inteligência e segurança de `gerarCNABParaLote`.
- Não altera migrações, RPCs ou esquemas de banco.

---

## 3. BLOCO B — AUDITORIA DE NAVEGAÇÃO PARA CENTRAL BANCÁRIA

### 3.1 Investigação dos Parâmetros URL
Em `src/pages/Operacional/IntermitentesLotes.tsx`:
- Linha 580: `navigate("/bancario?tab=intermitentes&origem=INTERMITENTE")` (Botão "Pagamentos e Remessas")
- Linha 932: `navigate("/bancario?tab=intermitentes&origem=INTERMITENTE")` (Botão "Avançar para Remessa")
- Linha 948: `navigate("/bancario?tab=retorno&origem=INTERMITENTE")` (Botão "Ver Conciliação Bancária")

Em `src/pages/CentralBancaria.tsx`:
```typescript
const [activeTab, setActiveTab] = useState<EstagioBancarioTab>(() => {
  const tabParam = searchParams.get("tab");
  if (tabParam === "PRONTAS_BANCO" || tabParam === "remessa") return "PRONTAS_BANCO";
  if (tabParam === "REMESSAS" || tabParam === "historico") return "REMESSAS";
  if (tabParam === "AGUARDANDO_RETORNO") return "AGUARDANDO_RETORNO";
  if (tabParam === "CONCILIACAO" || tabParam === "retorno") return "CONCILIACAO";
  if (tabParam === "PENDENCIAS") return "PENDENCIAS";
  return "TODAS";
});

const [origemFiltro, setOrigemFiltro] = useState<string>(() => {
  const orig = searchParams.get("origem");
  if (orig === "DIARISTA") return "DIARISTAS";
  if (orig === "INTERMITENTE") return "INTERMITENTES";
  if (orig === "CLT") return "CLT";
  const tab = searchParams.get("tab");
  if (tab === "diaristas") return "DIARISTAS";
  if (tab === "intermitentes") return "INTERMITENTES";
  return "TODAS";
});
```

### 3.2 Diagnóstico da Integração
1. **Tratamento de Origem:** `CentralBancaria.tsx` já possui fallback explícito para `tab === "intermitentes"` (linha 96) e `orig === "INTERMITENTE"` (linha 92), convertendo ambos com sucesso para `origemFiltro = "INTERMITENTES"`.
2. **Tratamento da Aba Ativa (`activeTab`):** Como `"intermitentes"` não é o nome de um estágio da esteira bancária, `activeTab` recai no fallback `"TODAS"`. Isso exibe todos os lotes de Intermitentes em qualquer estágio da esteira.
3. **Botão "Ver Conciliação Bancária":** O link `/bancario?tab=retorno&origem=INTERMITENTE` é resolvido perfeitamente para `activeTab = "CONCILIACAO"` e `origemFiltro = "INTERMITENTES"`.
4. **Dependência em Testes Regressivos:** Três testes existentes no repositório exigem estritamente a string `/bancario?tab=intermitentes&origem=INTERMITENTE`:
   - `src/test/intermitentes_lotes_etapa_e2e.test.ts` (linha 282)
   - `src/test/intermitentes_transicao_financeira_e2e.test.ts` (linha 87)
   - `src/test/intermitentes_saneamento_pre_hml.test.ts` (linha 926)

### 3.3 Conclusão do BLOCO B
O link atual funciona de maneira retrocompatível e consistente no ecossistema atual (compartilhando do mesmo padrão de `RhDiaristasPainel.tsx`, que usa `?tab=diaristas&origem=DIARISTA`). Recomenda-se manter a navegação existente para evitar quebra de testes e preservar o contrato com a Central Bancária.

---

## 4. BLOCO C — AUDITORIA DE PERMISSÕES E ROTAS

### 4.1 Mapeamento e Auditoria das 5 Rotas de Intermitentes

| Rota | Configuração em `App.tsx` | Regra em `ROUTE_ACCESS_RULES` | Módulo RBAC | Status de Segurança |
|---|---|---|---|---|
| `/operacional/intermitentes` | Protegida (`AuthGuard`) | `{ prefix: "/operacional/intermitentes", module: "operacoes_recebidas" }` | `operacoes_recebidas` | ✅ Seguro (Encarregado bloqueado, Gestor/Admin liberados) |
| `/operacional/intermitentes/lotes` | Protegida (`AuthGuard`) | Herda prefixo `/operacional/intermitentes` | `operacoes_recebidas` | ✅ Seguro (Encarregado bloqueado, Gestor/Admin liberados) |
| `/intermitentes/lotes` | Protegida (`AuthGuard`) | **Inexistente** | `undefined` | ⚠️ **Lacuna de Segurança** (Bypass de módulo para usuário autenticado) |
| `/intermitentes/aprovacoes` | Protegida (`AuthGuard`) | `{ prefix: "/intermitentes/aprovacoes", module: "processamento_rh" }` | `processamento_rh` | ✅ Seguro (RH/Gestor/Admin liberados) |
| `/intermitentes/inconsistencias` | Protegida (`AuthGuard`) | **Inexistente** | `undefined` | ⚠️ **Lacuna de Segurança** (Bypass de módulo para usuário autenticado) |

### 4.2 Causa Raiz das Lacunas Identificadas
Em `src/lib/access-control.ts`:
- A função `getRouteAccessRule(pathname)` busca a regra por correspondência de prefixo mais longo (`startsWith`).
- Quando a rota é um alias direto (ex: `/intermitentes/lotes` ou `/intermitentes/inconsistencias`), ela não inicia com `/operacional/intermitentes`.
- Como `rule` retorna `undefined`, o `AuthGuard` verifica apenas se há sessão (`!session`), mas não valida permissões de módulo com `canAccess(rule.module)`.

### 4.3 Proposta de Correção em `src/lib/access-control.ts` (Aguardando Autorização)
Adicionar as seguintes entradas em `ROUTE_ACCESS_RULES` sem criar perfis novos nem ampliar permissões:
```typescript
{ prefix: "/intermitentes/lotes", module: "operacoes_recebidas" },
{ prefix: "/intermitentes/inconsistencias", module: "operacoes_recebidas" },
{ prefix: "/inconsistencias", module: "operacoes_recebidas" },
```
Isso equaliza a governança dos aliases de Intermitentes com suas rotas canônicas operacionais.

---

## 5. BLOCO D — REGRESSÃO E EVIDÊNCIAS DE TESTE

### 5.1 Testes Executados
1. **Nova Suíte de Homologação de Contratos:**
   - Arquivo: `src/test/conv17_etapa02_saneamento_contratos.test.ts`
   - Testes: 11/11 aprovados (100% de sucesso).
   - Valida:
     - Confirmação em tempo de execução da inexistência de `gerarRemessaCNAB`.
     - Confirmação da existência e integridade de `gerarCNABParaLote`.
     - Validação de regras de acesso para `/operacional/intermitentes`, `/operacional/intermitentes/lotes` e `/intermitentes/aprovacoes`.
     - Diagnóstico formal das lacunas de prefixo.
2. **Suíte Canônica de Transição Financeira:**
   - Arquivo: `src/test/intermitentes_transicao_financeira_e2e.test.ts`
   - Testes: 5/5 aprovados.
3. **Suíte Oficial de Central Bancária:**
   - Arquivo: `src/test/conv11_central_bancaria.test.tsx`
   - Testes: 25/25 aprovados.
4. **Suíte de Segregação e Fechamento:**
   - Arquivo: `src/test/intermitentes_segregation.test.ts`
   - Testes: 9/9 aprovados.
   - Arquivo: `src/test/intermitentes_fechamento_periodo_e2e.test.ts`
   - Testes: 4/4 aprovados.
5. **Verificação Estática de Tipagem:**
   - Comando: `npx tsc --noEmit`
   - Resultado: Código de saída 0 (zero erros de compilação).

---

## 6. MATRIZ DE ARQUIVOS E IMPACTO

| Arquivo | Ação na ETAPA 02 | Risco Residual |
|---|---|---|
| `src/test/conv17_etapa02_saneamento_contratos.test.ts` | Criado (novo) | Zero (arquivo de teste automatizado) |
| `CONV-17-ETAPA02-SANEAMENTO-CONTRATOS.md` | Criado (relatório) | Zero (documentação de entrega) |
| `src/services/domain/intermitentes.service.ts` | Inalterado (Proposta de fachada documentada) | Zero até autorização |
| `src/components/bancario/CentralBancariaDrawerOficial.tsx` | Inalterado (Preservado) | Risco de runtime em clique no Drawer se não adicionada a fachada |
| `src/pages/Operacional/IntermitentesLotes.tsx` | Inalterado (Preservado) | Zero (compatibilidade comprovada) |
| `src/lib/access-control.ts` | Inalterado (Proposta de mapeamento documentada) | Zero até autorização |

---

## 7. PENDÊNCIAS QUE EXIGEM AUTORIZAÇÃO ANTES DA ETAPA 03

1. **Autorização para inclusão do método de fachada `gerarRemessaCNAB`** em `IntermitentesLoteServiceClass` (`src/services/domain/intermitentes.service.ts`) e `LoteFechamentoDiaristaServiceClass` (`src/services/domain/diaristas.service.ts`), delegando para `gerarCNABParaLote`.
2. **Autorização para inclusão das regras de rota** `{ prefix: "/intermitentes/lotes", module: "operacoes_recebidas" }` e `{ prefix: "/intermitentes/inconsistencias", module: "operacoes_recebidas" }` em `src/lib/access-control.ts`.

Aguardando validação do usuário antes de iniciar a **ETAPA 03 (Convergência Visual e Unificação dos Drawers)**.
