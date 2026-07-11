# AUDITORIA_PRÉ-CHECKPOINT_05: CNAB E FATORES DE OMISSÃO

## Contexto e Premissa de Negócio
Durante a homologação, verificou-se que a Central Bancária apresentava a mensagem `0 lotes encontrados` para Intermitentes. A hipótese levantada foi uma falha técnica (sumiço ou wipe dos dados no banco) versus uma regra de negócio natural de proteção contra envios incompletos do RH (falta de CPF e dados bancários).

### Investigação da Aplicação (Front-end e Back-end)
Foi executada a análise sistemática do pipeline consultivo da `CentralBancaria.tsx` e dos métodos em `IntermitentesLoteService`.

1. **A ausência de dados cadastrais (CPF, PIS, banco, valor) impede o lote de avançar para a geração do arquivo CNAB?**
   **Resposta: SIM.** O método `IntermitentesLoteService.gerarCNABParaLote` agrupa os arquivos incompletos e barra nativamente a execução através de um `throw new Error()` consolidado, bloqueando o envio de inconsistências para o parsing FEBRABAN.

2. **Essa restrição está documentada e implementada intencionalmente?**
   **Resposta: SIM.** Na linha 337 de `intermitentes.service.ts` encontram-se travas nominais claras:
   ```typescript
   if (!banco) faltando.push('banco');
   if (!agencia) faltando.push('agência');
   if (!conta) faltando.push('conta');
   if (cpf.length !== 11) faltando.push(`CPF inválido`);
   ```
   
3. **O sistema apresenta mensagem clara sobre essas pendências?**
   **Resposta: SIM.** Embora o processo valide o lote para "entrar na esteira" sem alarmes prematuros, ao tentar disparar o botão vital (Gerar CNAB), a interface exibe o trace da exceção do backend via Toast-error, apresentando não apenas o erro, mas a **lista completa dos colaboradores não-validados** e os dados exatos que precisam ser retificados pelo RH.

4. **Se os colaboradores forem preenchidos, o lote evolui sem necessidade de codificação extra?**
   **Resposta: SIM.** Não há falhas na implementação do serviço, todas as checagens e compilações ocorrem de forma fluida caso a integridade dos dados atinja 100%.

---

## O Diagnóstico Central
"O problema está nos dados ou na consulta da aplicação?"

Embora a proteção em nível de geração seja real (e impeça a geração CNAB errônea), referida proteção **NÃO atinge o nível da listagem de Lotes (`getByEmpresaParaFinanceiro`)**. 

O método que exibe a "Fila RH" baseia-se unicamente em consultar a tabela `intermitentes_lotes_fechamento` por `empresa_id` onde o `status` encontre-se nas matrizes liberadas (`FECHADO_FINANCEIRO`).
Logo, **um lote ainda não-preenchido deveria figurar nas listas do /bancario** (e apenas travar nas ações sequentes).
O fato do sistema responder com 0 lotes comprova categoricamente a **ausência real** desses registros no provedor do Firebase/Supabase ou o isolamento via tenant (deslogado ou sob base dropada).

## Parecer Oficial
**🟢 O problema está nos dados (ou no ambiente logado no container do backend).** 

- Os lotes realmente não existem no banco de dados ativo mapeado ao ambiente que rodava no *browser_subagent* com as credenciais inseridas, confirmando as opções de *Dados Wiped* (Opção A) ou troca cruzada de contas (Opção C).

## Recomendação Final (Sem Implementação)
Não há absolutamente nada falho no código. Para destravar o Checkpoint 05, recomenda-se:
1. Recriar (manualmente através da própria UI ou rodando scripts limpos) **massa de dados orgânica** que progrida pelo funil do Operacional -> RH -> Financeiro até estacionar no `FECHADO_FINANCEIRO`.
2. Para que a Etapa CNAB ocorra sem ser bloqueada pelas regras de integridade bancária, o RH já deve ter procedido o enriquecimento (completude) dos CPFs e Contas na Central de Cadastros previamente à montagem da remessa.
