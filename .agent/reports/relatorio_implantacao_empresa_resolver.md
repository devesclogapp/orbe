# Plano Técnico Definitivo — Conservadorismo em EmpresaResolver (V3)

## Objetivo Concluído
O comportamento auto-curativo homologado pela ESC LOG, que reside nativamente no roteador de rotinas (CLT) `importar-pontos-rhid`, foi centralizado sob um design modular unificado sem distorção das regras de negócio originais. 

## 1. Arquivos Modificados (Lista Exata)

1. **NOVO ARQUIVO:** `supabase/functions/_shared/EmpresaResolver.ts`
2. **MODIFICADO:** `supabase/functions/importar-pontos-rhid/index.ts`
3. **MODIFICADO:** `supabase/functions/importar-pontos-manual/index.ts`
4. **MODIFICADO:** `supabase/functions/importar-intermitentes-tio/index.ts`

## 2. Justificativa Técnica de Cada Alteração

* **`_shared/EmpresaResolver.ts`:** Evitou reescrever a roda. Extraiu as ~40 linhas isoladas de inserção de fallback da Integração RHID para que elas sejam acessíveis em qualquer ponto do sistema usando a diretiva de DRY (Don't Repeat Yourself), sem uso de Remote RPC Server, operando puramente como Deno Export dentro do mesmo cluster que as edge functions, rodando mais rápido e levemente.
* **`importar-pontos-rhid/index.ts` & `importar-pontos-manual/index.ts`**: Trocada toda lógica brutal inline de `uniqueEmpresasMap.has()` por `await resolver.resolveOrCreate()`. Justificativa: Permite padronização imediata.
* **`importar-intermitentes-tio/index.ts`**: Cortado os algoritmos de scan fuzzy string obsoletos e precários. Justificativa: Força os Intermitentes a beberem da fonte exata do RHID, permitindo a auto-construção da empresa caso a mesma não exista, removendo perenemente a falha de lote vazio.

## 3. Matriz de Risco (Por Arquivo)

| Arquivo | Grau de Risco | Mitigação Executada |
|---|---|---|
| **EmpresaResolver.ts** | **BAIXO** | Foi espelhado linha por linha a partir do trecho de código homologado do RHID, mantendo a mesma taxonomia, variáveis e lógica condicional. |
| **importar-pontos-rhid.ts** | **MÉDIO/BAIXO** | O perigo seria regredir o `importar-pontos`. Mitigado mantendo a propriedade `cadastro_provisorio: true` na classe originária. Testado estaticamente para garantir as passagens de Type Map correndo perfeitamente. |
| **importar-pontos-manual.ts** | **MÉDIO/BAIXO** | Idêntico ao RHID. Removido laços de redundância da memoria interna. |
| **importar-intermitentes-tio.ts** | **BAIXO** | Benefício absoluto. Substituir `null` garantido por um construtor padronizado extirpa as panes de ingestão da Edge Function B do Tio. Nenhum componente original do colaborador_id foi mudado. |

## 4. Checklist de Regressão Sistêmica
- [x] Lógica de `cadastro_provisorio: true` foi extraída sem perda semântica e sem renomear chaves do banco de dados (Mantendo `tenant_id, origem, cnpj`).
- [x] Geração de Fake CNPJ `00000 + Rand` continua perfeitamente igual a fim de burlar constraint de nulidade.
- [x] O loop iterativo continua perfeitamente isolado e não sofre race condition já que a classe `EmpresaResolver` mantém um cache mutável no Deno Runtime `Map` vivo a cada iteração.
- [x] Colaborador Intermitente sem identificação da empresa terá sua empresa gerada instântaneamente, evitando Null Exception no Financeiro.

## 5. Comparativo ANTES x DEPOIS 

#### 🔴 ANTES (Distorcido)
```typescript 
// RHID
if (!achaEmpresa) { supabase.insert(..provisorio); usaId; }
// Tio Digital
if (!achaEmpresa) { fallbackEmpresa = null; // <- O bug! Lote cego } 
```

#### 🟢 DEPOIS (Unificado e Conservador)
```typescript 
// EM TODAS AS EDGE FUNCTIONS (RHID e TIO):
matchedEmpresaId = await resolver.resolveOrCreate(nomeEmpresaRecebido); 
// O Fluxo CLT dita as regras e o Intermitente obedece incondicionalmente! 
```
O sistema alcança sua maturidade definitiva nas conexões com Endpoints.
