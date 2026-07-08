# RELATÓRIO DE AUDITORIA — ARQUIVO CNAB ITAÚ SISPAG (DOMÍNIO 02 — DIARISTAS)

## Objetivo
Auditoria técnica da geração do arquivo CNAB para pagamento de diaristas com base no layout Itaú SISPAG (240 posições). 

## Informações do Arquivo Auditado (Output Simulado/Real)
- **Arquivo Gerado:** `cnab_test.txt` / (Correspondente a `CNAB240_BB_YYYYMMDD_SEQ...txt`)
- **Extensão:** `.txt` (✔ Correto)
- **Quantidade de linhas:** 5 linhas no lote de teste (✔ Correto - variando conforme faturas)
- **Tamanho de cada linha:** 240 posições (✔ Correto)
- **Estrutura Encontrada:** 
  - Header Arquivo
  - Header Lote
  - Segmento A (Detalhe)
  - Segmento B (Detalhe - via `CNAB240BBWriter.ts`)
  - Trailer Lote
  - Trailer Arquivo
  (✔ Estrutura Padrão Febraban 240 encontrada)

## Divergências e Inconsistências Mapeadas

Através da auditoria do pipeline gerador (`CNAB240BBWriter.ts` e `cnabRemessaArquivo.service.ts`), foram encontradas divergências estruturais críticas entre a saída atual do ORBE e o layout SISPAG Conta a Pagar:

| Regra / Dado | Esperado (Itaú SISPAG) | Encontrado (Atual) | Criticidade |
| --- | --- | --- | --- |
| **Código do Banco** | `341` | Hardcoded para `001` (Banco do Brasil) em `CNAB240BBWriter.ts` (e.g. `bancoCodigo: conta.banco_codigo ?? '001'`). | **CRÍTICA** (Bloqueia totalmente no Itaú) |
| **Nome do Banco** | `BANCO ITAU SA` | Hardcoded para `BANCO DO BRASIL` | Média |
| **Nome do Arquivo** | Nomenclatura livre ou padronizada pela empresa (Extensão .txt) | Fixo com prefixo `CNAB240_BB_...` | Média |
| **Layout / Produto** | Itaú SISPAG / Contas a Pagar (Pagamento a Fornecedores/Diaristas) | O gerador atual está modelado usando classes exclusivas e rígidas do Banco do Brasil. | **CRÍTICA** (Campos de convênio e código de remessa divergem) |
| **Segmento A** | Obrigatório para SISPAG 240. | Presente, mas contém código de instrução fixo p/ BB (ex: Câmara compensação). | Alta |
| **Segmento B** | Quando aplicável (cpf/cnpj). | Presente e gerado. | Baixa |
| **Formato Agência/Conta** | 4 posições Agência, s/ dígito. 5 posições Conta + 1 dígito. | A estrutura Febraban foi gerada, mas o Itaú possui padronagem exata na formatação de Zeros. | Alta | 

## Validação de Totais e Obrigações

- **Totais de Registros e Lotes:** Os trailers computam corretamente o total de registros (5) e somatórios de valores, bem idênticos ao padrão Febraban genérico.
- **Campos Obrigatórios preenchidos:** 
  - Nome do Favorecido, CPF, Banco e Valor possuem preenchimento validado e protegido por exceção no script - o lote é abortado (com consistência) em caso de valor DIVERGENTE do financeiro ou dados ausentes. (✔ Positivo arquiteturalmente).

## Conclusões e Correções Necessárias

**O arquivo gerado não passará pela validação do Itaú Empresas no seu estado atual**, pois ele foi concebido com hardcodings para o Banco do Brasil (001), embora obedeça à volumetria de 240 posições.

1. **Desacoplamento do Banco:** 
   O módulo de geração (`CNAB240BBWriter`) está intrinsicamente ligado às constantes do BB. É preciso criar um `CNAB240ItauWriter` dedicado para respeitar o manual SISPAG em suas particularidades operacionais (código de serviço de pagamento sispag, convênio, e forma de pagamento - tipo 41 TED Outra Titularidade, etc).
2. **Correção de Constantes e Layout Lote:**
   Adequar `BANCO_CODIGO` e os campos de convênio exigidos para `341`.
3. **Seleção baseada na Empresa:** 
   O `cnabRemessaArquivo.service.ts` deve invocar a factory correspondente ao banco selecionado (`341` = Itaú, `001` = BB) para que o ORBE seja Agnóstico à Conta.
