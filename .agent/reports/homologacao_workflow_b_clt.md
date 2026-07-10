# RELATÓRIO EXECUTIVO E2E — WORKFLOW B (PROCESSAMENTO CLT)

## Visão Geral
Este relatório apresenta os resultados da homologação E2E (End-to-End) do **Workflow B**, responsável pela importação e consolidação de registros de ponto a partir do sistema RHID. O escopo desta auditoria engloba a entrada de dados operacionais até a persistência no banco (tabela `registros_ponto`). A base de homologação foi analisada sob a ótica da estabilidade, escalabilidade e da arquitetura implementada.

As implementações auditadas foram:
1. Edge Function `importar-pontos-rhid` (recebimento JSON de webhook N8N).
2. Edge Function `importar-pontos-manual` (recebimento manual de CSV/Excel pelo frontend).
3. Componentes frontend `Pontos.tsx` e lógica de `PontoService`.

---

## 🛑 LISTA COMPLETA DE PROBLEMAS ENCONTRADOS

### 🔴 CRÍTICOS
1. **Falha de Self-Healing para Vinculação de `empresa_id` (importar-pontos-rhid)**
   * **Causa Raiz:** No passo de criar pré-cadastros desconhecidos, a função tenta encontrar o `empresa_id` usando a instrução `uniqueEmpresasMap.has(...)`. Contudo, o dicionário `uniqueEmpresasMap` é apenas inicializado (`const uniqueEmpresasMap = new Map();`) e **NUNCA** é preenchido com dados do banco.
   * **Impacto:** Todo colaborador criado via Self-Healing pela automação do RHID cairá sempre com `empresa_id = null`. Isso impede o vínculo com a respectiva empresa, gerando inconsistências no ERP.

2. **Falta de Fallback por CPF (importar-pontos-rhid)**
   * **Causa Raiz:** A edge function do RHID correlaciona colaboradores usando apenas `.pessoa_matricula` e `.pessoa_nome`. Diferente do Workflow manual que considera CPF (`cpf_colaborador`), o conector de automação ignora essa propriedade por completo.
   * **Impacto:** Fere a Regra de Negócio de Homologação. Maior probabilidade de duplicação caso um nome seja grafado diferente e a matrícula retorne errada, já que o CPF (ID forte) é ignorado.

3. **Duplicação Silenciosa em Idempotência (ON CONFLICT com `colaborador_id` NULL)**
   * **Causa Raiz:** Nas rotinas de UPSERT (`registros_ponto`), usa-se `onConflict: 'colaborador_id,data'`. Quando a inserção do colaborador falha e a marcação de ponto é classificada como `inconsistente` (onde `colaborador_id` fica NULL), a instrução ON CONFLICT não funciona porque no PostgreSQL `NULL != NULL`.
   * **Impacto:** Ao reexecutar o fluxo (idempotência), o sistema vai inflar e duplicar continuamente marcações "inconsistentes" da mesma data.

### 🟡 MÉDIOS
4. **Problema Crítico de Escalabilidade (Vazamento de Memória Potencial)**
   * **Causa Raiz:** A Edge function `importar-pontos-rhid` faz `.select('id, nome, matricula, empresa_id')` indiscriminado puxando **todos** os colaboradores do `tenant_id` para a memória da Deno Edge.
   * **Impacto:** Quando o ERP atingir dezenas de milhares de colaboradores, a Edge Function romperá o limite de memória/tempo (Worker Timeout) da infraestrutura serverless, indisponibilizando a rota de importação do N8N.
   * **Solução Recomendada:** Filtrar o Query baseado unicamente nas matrículas ou CPFs que efetivamente vieram no payload do N8N.

5. **Falha de Responsabilidade Arquitetural (Geração/Download/Parser do CSV vs N8N)**
   * **Problema:** Foi definido como requisito conferir: "Geração do Relatorio, Download do CSV e Parser". Porém, toda orquestração de download é delegada a um fluxo externo (n8n/Make). O ERP desconhece essa rotina, pois a Edge Function já recebe um array em JSON limpo e formatado.
   * **Risco:** O código no Orbe está confiando plenamente que o n8n sanitiza, faz parsing dos delimitadores de CSV e tipa tudo perfeitamente. Se o delimitador do CSV quebrar, o erro ocorre fora do Orbe, invisível para as métricas do ERP. Não existem rotinas robustas de validação de schemas em JSON-in.

### 🟢 BAIXOS
6. **Formato ISO e Hardcoded timezone**
   * **Problema:** Tratar conversões de planilhas locais para GMT dependendo da máquina de parseamento. Se os n8n rodarem em UTC e o RHID puxar com UTC, ao converter uma data de São Paulo às 23h haverá troca do dia nominal na data do ponto.

---

## 🛠 PLANO DE CORREÇÃO PRIORIZADO (Ação Imediata)

1. **(CRÍTICO) Inicializar e popular `uniqueEmpresasMap` na Edge Function `importar-pontos-rhid`.**
2. **(CRÍTICO) Adicionar o Fallback por CPF na estrutura de Self-Healing da Edge Function `importar-pontos-rhid`.**
3. **(CRÍTICO) Ajustar a regra de Idempotência:** Mudar do UPSERT simples para uso preferencial de uma chave única estrita gerada no backend (`hash(colaborador_id/matricula + data + tenant_id)`) ou tratar pontualmente onde `colaborador_id` é nulo em updates condicionais ao invés de UPSERT nativo vulnerável a Nulls.
4. **(MÉDIO) Otimizar Query de Correlacionamento Colaborador:** Ao invés de `select * from colaboradores`, levantar explicitamente um Array de Matrículas do payload `items` e usar `in('matricula', arrayMatriculas_do_Payload)`.

---

## 🏁 CONCLUSÃO
**Status de Homologação:** ❌ **NÃO HOMOLOGADO / BLOQUEADO**

Apesar da importação base funcionar e persistir, o sistema possui erros críticos nos requisitos primários da homologação que inviabilizam declará-lo como Concluído, em destaque o furo na identificação de "empresas_id" para self-healing e ao vazamento no UPSERT por divergência de Null no banco de dados.

**Próximo Passo:** Implementar o plano de correção e re-executar os ciclos de idempotência, priorizando a estabilização das Edge Functions. Apenas com estas correções o motor do RH estará seguro para calcular as horas.
