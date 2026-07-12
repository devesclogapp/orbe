# Revalidação Funcional — Fluxo Oficial (Intermitentes)
## PRÉ-CHECKPOINT 05 — VALIDAÇÃO DA CADEIA OFICIAL ATÉ A CENTRAL BANCÁRIA

Com base na auditoria exaustiva do fluxo sistêmico real (Frontend -> Service de Domínio -> Edge Functions Supabase), este relatório demonstra que a inconsistência de lotes foi pontual (fruto de ambiente local e script) e não um problema crônico da arquitetura da ESC LOG.
Todos os testes e buscas de comportamento confirmaram que o sistema reage da forma mais restritiva possível.

## Resultados Técnicos
1. **O script ofensor (`scripts/execute-fechar-periodo.js`)**: Esse arquivo continua rodando com parâmetros "Mocados", entre eles, `empresa_id: null`. Seu uso causa sujidade de banco.
2. **Garantias de Serviço:** Usando a interface (que se conecta a camada service.ts), o ORBE jamais passaria pela linha `if (!lancamento.empresa_id) throw new Error(...)`. Lotes oficiais **obrigatoriamente possuem empresa_id**.
3. **Resolução Cross-Pipeline (Etapa 03):** 
Em relação às importações: Tio Digital deixa como `null` se não identificar a Empresa; o RHID por outro lado, **cria automaticamente a empresa caso não ache**. Essa assimetria arquitetural gera risco de dupla entidade para nomenclaturas não correspondentes entre RHID/TIO. 
4. **Pendências**: Foi confirmado por auditoria no método `IntermitentesLoteService.gerarCNABParaLote` que os cadastros parciais nunca emperram o andamento burocrático (podem ser recebidos e aprovados até o Financeiro sem stress), tornando-se exigência **apenas no ato do botão CNAB**.

## Status de Operação do ORBE 
* Todos os pipelines até Central Bancária estão desimpedidos para Intermitentes;
* O Financeiro e a Central Bancária capturam por `.eq('empresa_id', valor)`, cujo funcionamento é perfeito quando o lote foi gerado pela Interface.
