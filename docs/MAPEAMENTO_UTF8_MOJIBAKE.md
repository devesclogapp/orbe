# Mapeamento de Erros de Acentuação UTF-8 (Mojibake)

Critério: ocorrências contendo `Ã`, `Â` ou `�` no código-fonte (`src/`).

## Resumo
- Arquivos com ocorrência: 16
- Ocorrências totais: 243

## Top Arquivos Afetados
- src\pages\Colaboradores.tsx: 90 ocorrência(s)
- src\pages\CentralFinanceira.tsx: 68 ocorrência(s)
- src\components\layout\navigationMeta.ts: 32 ocorrência(s)
- src\components\operacoes\OperacoesTableBlock.tsx: 8 ocorrência(s)
- src\pages\Operacoes.tsx: 6 ocorrência(s)
- src\services\base.service.ts: 6 ocorrência(s)
- src\pages\CentralCadastros.tsx: 6 ocorrência(s)
- src\services\cnab\cnab240-posicional.ts: 5 ocorrência(s)
- src\pages\LancamentoProducao.tsx: 5 ocorrência(s)
- src\pages\Fechamento.tsx: 5 ocorrência(s)
- src\pages\Pontos.tsx: 5 ocorrência(s)
- src\pages\Producao\DiaristasLancamento.tsx: 2 ocorrência(s)
- src\pages\Rh\RhDiaristasPainel.tsx: 2 ocorrência(s)
- src\pages\Financeiro\CentralBancariaDiaristas.tsx: 1 ocorrência(s)
- src\utils\financeiro.ts: 1 ocorrência(s)
- src\pages\RegrasOperacionais.tsx: 1 ocorrência(s)

## Exemplos por Arquivo (amostra)
### src\pages\Colaboradores.tsx
- Linha 35: tipo_contrato: "Hora" as "Hora" | "OperaÃ§Ã£o" | "Mensal",
- Linha 86: if (tipo === "PRODUÃ‡ÃƒO" || tipo === "PRODUCAO") return "Freelancer";
- Linha 94: if (tipo === "DIARISTA") return "DiÃ¡ria";
- Linha 96: if (tipo === "PRODUÃ‡ÃƒO" || tipo === "PRODUCAO") return "ProduÃ§Ã£o";
- Linha 97: if (tipo === "TERCEIRIZADO") return "ProduÃ§Ã£o";

### src\pages\CentralFinanceira.tsx
- Linha 62: // etapa 2 â€” anÃ¡lise financeira
- Linha 160: toast.success("PerÃ­odo fechado!", {
- Linha 161: description: "A competÃªncia foi fechada e protegida contra ediÃ§Ãµes.",
- Linha 166: toast.error("Erro ao fechar perÃ­odo", { description: err.message });
- Linha 206: // lotes que requerem aÃ§Ã£o do Financeiro

### src\components\layout\navigationMeta.ts
- Linha 19: { pattern: "/operacional/operacoes", label: "OperaÃ§Ãµes Recebidas", section: "Entradas Operacionais" },
- Linha 21: { pattern: "/producao", label: "LanÃ§amentos Operacionais", section: "Entradas Operacionais" },
- Linha 22: { pattern: "/producao/diaristas", label: "LanÃ§amento de Diaristas", section: "Ambiente Externo", parentPath: "/producao" },
- Linha 24: { pattern: "/producao/servicos-extras", label: "ServiÃ§os Extras", section: "Entradas Operacionais", parentPath: "/producao" },
- Linha 25: { pattern: "/importacoes", label: "ImportaÃ§Ãµes", section: "Entradas Operacionais" },

### src\components\operacoes\OperacoesTableBlock.tsx
- Linha 120: { value: "nf_numero", label: "NF (SIM/NÃO ou número)" },
- Linha 315: getLinhaOriginalValue(item, "OBSERVACAO", "OBSERVAÇÃO") ??
- Linha 406: if (nfRaw === "N" || nfRaw === "NAO" || nfRaw === "NÃO") nfRaw = "NÃO";
- Linha 1421: if (nfRaw === "N" || nfRaw === "NAO" || nfRaw === "NÃO") nfRaw = "NÃO";
- Linha 1423: const percentualCalculado = nfRaw === "SIM" ? 5 : (nfRaw === "NÃO" ? 0 : parseLocaleNumber(next.percentual_iss));

### src\pages\Operacoes.tsx
- Linha 607: if (nfNumero && nfNumero !== "NAO" && nfNumero !== "NÃO") nfComRegistro += 1;
- Linha 781: const operacaoName = String(getVal(row, "DESCRIÇÃO", "DESCRICAO", "OPERAÇÃO", "OPERACA", "SERVIÇO", "SERVIC", "TIPO") || "");
- Linha 786: const transportadoraName = String(getVal(row, "TRANSPORTADORA", "VIAÇÃO", "VIACAO") || "");
- Linha 813: if (nfRaw === "N" || nfRaw === "NAO" || nfRaw === "NÃO") nfRaw = "NÃO";
- Linha 816: const pIssFinal = nfRaw === "SIM" ? 5 : (nfRaw === "NÃO" ? 0 : issRawValue);

### src\services\base.service.ts
- Linha 30: // SANITIZAÇÃO GLOBAL DE PAYLOADS
- Linha 114: if (tipo === "PRODUÇÃO" || tipo === "PRODUCAO") return "Freelancer";
- Linha 123: if (tipo === "PRODUÇÃO" || tipo === "PRODUCAO") return "Produção";
- Linha 3517: // TIPOS PARA REGRAS DINÂMICAS
- Linha 3546: // SERVIÇOS PARA REGRAS DINÂMICAS

### src\pages\CentralCadastros.tsx
- Linha 416: if (["NAO", "NÃO", "FALSE", "0", "INATIVO", "INATIVA", "NO"].includes(normalized)) return false;
- Linha 1548: ? "PRODUÇÃO"
- Linha 1552: : contratoNormalizado === "OPERACAO" || contratoNormalizado === "OPERAÇÃO"
- Linha 1754: descricao: getRowValue(row, "DESCRICAO", "DESCRIÇÃO") || null,
- Linha 2899: <SelectItem value="PRODUÇÃO">PRODUÇÃO</SelectItem>

### src\services\cnab\cnab240-posicional.ts
- Linha 103: // HELPERS DE FORMATAÇÃO POSICIONAL
- Linha 117: .replace(/[ÃÀÁÂä]/gi, 'A')
- Linha 531: // CONVERSÃO PARA WINDOWS-1252
- Linha 594: // VALIDAÇÃO PRÉVIA DOS DADOS
- Linha 629: // FUNÇÃO PRINCIPAL

### src\pages\LancamentoProducao.tsx
- Linha 1547: {/* ── SEÇÃO: OPERAÇÃO ── */}
- Linha 1692: {form.nf_emite ? "SIM" : "NÃO"}
- Linha 1720: {/* ── SEÇÃO: FINANCEIRO ── */}
- Linha 1829: {/* ── SEÇÃO: EQUIPE ── */}
- Linha 1877: {/* ── SEÇÃO: RESPONSÁVEL E OBSERVAÇÃO ── */}

### src\pages\Fechamento.tsx
- Linha 124: <p className="text-xs text-muted-foreground">pendentes de liberaÃ§Ã£o</p>
- Linha 129: <p className="text-xs text-muted-foreground">aguardando aprovaÃ§Ã£o</p>
- Linha 134: <p className="text-xs text-muted-foreground">aguardando aprovaÃ§Ã£o</p>
- Linha 137: <p className="text-[11px] uppercase tracking-wide text-muted-foreground">BancÃ¡rio</p>
- Linha 139: <p className="text-xs text-muted-foreground">preparaÃ§Ã£o remessa</p>

### src\pages\Pontos.tsx
- Linha 280: const empresaNome = getImportRowValue(row, "EMPRESA", "EMPRESAS", "RAZÃO SOCIAL", "RAZAO SOCIAL", "CLIENTE", "NOME DA EMPRESA", "NOME DA CLIENTE");
- Linha 284: const cargo = getImportRowValue(row, "CARGO", "FUNÇÃO", "FUNCAO", "CARGO DO COLABORADOR");
- Linha 292: const status = getImportRowValue(row, "STATUS", "SITUAÇÃO", "SITUACAO") || "pendente";
- Linha 297: const observacoes = getImportRowValue(row, "OBSERVACOES", "OBSERVAÇÕES", "OBS", "OBSERVAÇÃO", "OBSERV");
- Linha 313: // ========== DADOS BRUTOS - SEM VALIDAÇÃO DE EXISTÊNCIA ==========

### src\pages\Producao\DiaristasLancamento.tsx
- Linha 260: // Semana fechada = há lançamentos cujo status NÃO é em_aberto/EM_ABERTO
- Linha 965: <li>Status alterado para <span className="font-semibold text-amber-700">AGUARDANDO VALIDAÇÃO DO RH</span></li>

### src\pages\Rh\RhDiaristasPainel.tsx
- Linha 514: // SINCRONIZAÇÃO VISUAL: Se o lançamento ainda estiver 'em_aberto' no banco mas o lote já avançou,
- Linha 592: // SINCRONIZAÇÃO: Usa status do lote se o registro ainda estiver 'em_aberto' no DB

### src\pages\Financeiro\CentralBancariaDiaristas.tsx
- Linha 1111: {/* ── C2: MODAL DE CONFIRMAÇÃO DE PAGAMENTO ── */}

### src\utils\financeiro.ts
- Linha 190: const hasNfInput = !!nfRaw && nfRaw !== "N" && nfRaw !== "NAO" && nfRaw !== "NÃO";

### src\pages\RegrasOperacionais.tsx
- Linha 941: const formaPagamentoNome = getImportRowValue(row, "FORMA DE PAGAMENTO", "FORMA DE PAGAMENTO PADRAO", "FORMA DE PAGAMENTO PADRÃO");

