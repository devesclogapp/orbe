# RELATÓRIO: CAUSA RAIZ LOTE MULTIEMPRESA (INTERMITENTES)

**Data da Auditoria:** 13/07/2026
**Lote Contaminado:** `6e9b5afc-e2f0-4ae8-b0ef-9c581da5e8f0`

---

## 1. Localização da Função de Fechamento

O fechamento de período dos Intermitentes ocorre na seguinte camada:

- **Arquivo:** `src/services/domain/intermitentes.service.ts`
- **Função:** `IntermitentesLoteServiceClass.fecharPeriodo(params)`

Não há uma Edge Function ou RPC encarregada de fazer essa mutação; o processamento é feito no client/backend via script Typescript chamando a API do Supabase em duas etapas (Insert do Lote seguido por Update dos Lançamentos).

---

## 2. Por quais campos o fechamento agrupa hoje?

Atualmente, a lógica tenta agrupar **exclusivamente por `empresa_id`**, como evidenciado no trecho:

```typescript
const groups = new Map<string, typeof lancamentos>();
for (const lancamento of lancamentos) {
    // ...
    const id = lancamento.empresa_id;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(lancamento);
}
```

O problema é que o código não agrupa utilizando uma chave composta sólida (como combinado de `tenant_id + empresa_id + competencia`). Pior, a lógica cria os grupos usando a chave como string, mas a ausência de amarrações no backend nas primeiras iterações permitiu que um lote fosse criado com `empresa_id = null`. 

---

## 3. Em qual ponto o `empresa_id` deixa de ser propagado?

O problema ocorreu antes da implementação das travas de erro no laço. Anteriormente, não havia a verificação restrita de `if (!lancamento.empresa_id) throw new Error(...)`.
Logo, ocorreu o seguinte fluxo:
1. Lançamentos sem `empresa_id` ou de múltiplas empresas chegaram no payload, possivelmente quando um fechamento genérico (todas as empresas) ocorria, o group map usava um bypass ou agrupava num lote "pai" em outra parte do código não segura.
2. Como os lançamentos pertenciam ao mesmo `tenant`, e havia falta de normalização, eles foram todos inseridos sob um lote onde `empresa_id` ficou nulo `(const { id: lote.id } = await this.supabase.from('intermitentes_lotes_fechamento').insert({ ... empresa_id: null }))`. Devido a isso, um lote multiempresa nasceu, com 11 registros, abraçando 3 empresas diferentes.
3. Isso prova que o backend confiava no frontend para separar o `empresaId` durante a requisição, o que abre brecha pra criação com `empresa_id = null` se `params.empresaId` foi enviado null ou undefined via interface de "Todas as empresas".

---

## Conclusão de Auditoria e Correção Estrutural (Próximos Passos)

- A função precisa usar explicitamente o combinador: `${tenantId}_${lancamento.empresa_id}_${competencia}`.
- Embora parte do erro de `empresa_id = null` tenha sido tratado pelo throw de erro na linha 79, a estrutura do `groups = new Map()` deve ser reforçada para não assumir riscos de multiempresa no mesmo ID submetido, e blindada com validações secundárias de que o payload do array efetivamente possui 1 tenant, 1 competência, e 1 empresa, e também bloqueios rígidos antes da tabela de lote ser alterada.
