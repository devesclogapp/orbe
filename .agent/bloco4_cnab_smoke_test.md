# Relatório de Smoke Bancário — Bloco 4 (CNAB)
As validações deste smoke test abrangem as mutações atômicas de RPC e a segregação estrita por tenant, ambiente e empresa originadora. Execute-o no ambiente (Staging ou Produção) para emissão de Go Final.

---

### Cenário F — Auditoria Estrutural
Antes de realizar os testes funcionais, valide via SQL ou CLI a presença da infraestrutura do Bloco 4:
| Step | Checklist | Status | Notas |
|:---|:---|:---:|:---|
| 1 | `cnab_remessa_itens` existe | PENDENTE | |
| 2 | `tenant_id` NOT NULL nas tabelas | PENDENTE | |
| 3 | `empresa_id` NOT NULL nas tabelas | PENDENTE | |
| 4 | FK criadas | PENDENTE | |
| 5 | `rpc_registrar_cnab_remessa` existe | PENDENTE | |
| 6 | `rpc_aplicar_cnab_retorno` existe | PENDENTE | |
| 7 | índices UNIQUE existentes | PENDENTE | Idempotência e hash (`idx_cnab_retorno_arquivos_hash`) |
| 8 | hash_arquivo existente na tabela retorno | PENDENTE | |
| 9 | RLS funcionando | PENDENTE | |
| 10| `auth.uid()` validado nas RPCs | PENDENTE | |

---

### Cenário A — Remessa PROD
| Step | Checklist | Status | Notas |
|:---|:---|:---:|:---|
| 1 | Central Bancária mostra apenas lotes PROD | **PASS** | Validado pela Automação UI. Nenhuma empresa teste vaza para dropdowns. |
| 2 | Conta bancária HML não aparece | **PASS** | Isolamento HML/PROD efetivo |
| 3 | Seleção gera somente itens PROD | **PASS** | Contadores segregam instantaneamente ao mudar Switcher |
| 4 | Total visual corresponde à soma dos itens | PENDENTE | Valores coerentes com o CNAB gerado |
| 5 | Arquivo é registrado uma única vez | PENDENTE | Geração envia para `rpc_registrar_cnab_remessa` atomico |
| 6 | Segunda geração é bloqueada | PENDENTE | Status de lotes 'cnab_gerado' / Unique Arquivo |
| 7 | Registro mantém tenant, empresa, conta e hash | PENDENTE | FK e restrições corretas na tabela remessa |

**Geração Remessa (PROD)**
- Ambiente: Produção
- Empresa: <Empresa_PROD_Nome>
- Conta bancária: <Conta_PROD_ID>
- Origem: [CLT / Intermitente / Diarista]
- Lote: Lote Fechamento Oficial 
- Quantidade de itens: ___
- Valor esperado: R$ ___
- Hash (se aplicável): ___
- **Resultado da Geração**: PASS/FAIL

---

### Cenário B — Remessa HML
| Step | Checklist | Status | Notas |
|:---|:---|:---:|:---|
| 1 | Central HML mostra somente lotes HML | **PASS** | |
| 2 | Nenhum lote ou beneficiário PROD aparece | **PASS** | Fail-closed segregation efetivo |
| 3 | Arquivo HML é gerado e registrado no ambiente HML | PENDENTE | Empresa associada à remessa |
| 4 | Arquivo HML não aparece na Central PROD | **PASS** | |

**Geração Remessa (HML)**
- Ambiente: Homologação
- Empresa: <Empresa_HML_Nome>
- Conta bancária: <Conta_HML_ID>
- Origem: [CLT / Intermitente / Diarista]
- Lote: ___
- Quantidade de itens: ___
- Valor esperado: R$ ___
- Hash (se aplicável): ___
- **Resultado da Geração**: PASS/FAIL

---

### Cenário C — Retorno Bancário e Conciliação
Atenção: Subir arquivo gerado e controlado, editando manualmente as posições de Retorno/Código 06 para validar a baixa.
| Step | Checklist | Status | Notas |
|:---|:---|:---:|:---|
| 1 | Arquivo é identificado pela remessa persistida | PENDENTE | Match por Remessa ID / Hash / Doc / Valor |
| 2 | Retorno PROD não localiza remessa HML | PENDENTE | Isolation check (origem tenant) |
| 3 | Retorno HML não localiza remessa PROD | PENDENTE | |
| 4 | Baixas correspondem somente aos itens da remessa | PENDENTE | Mapeamento nativo RH `rh_financeiro_lote_itens` e `faturas` |
| 5 | Reimportação do mesmo arquivo é bloqueada | PENDENTE | Índice unique hash arquivo invoca 23505 |
| 6 | Nenhuma baixa parcial ocorre diante de divergência | PENDENTE | Constraint OCC (`v_linhas_afetadas = 1`) atômica |
| 7 | Quantidade de linhas afetadas corresponde à esperada | PENDENTE | |

**Retorno e Conciliação**
- Ambiente: Produção / HML
- Empresa: ___
- Conta bancária: ___
- Origem do Arquivo: Arquivo Controlado Gerado em Cenario A/B
- Quantidade de itens reconciliados: ___
- Valor esperado conciliação: R$ ___
- Hash de Retorno: ___
- **Resultado do Retorno**: PASS/FAIL
- **Resultado da Conciliação**: PASS/FAIL

---

### Cenário D — Segregação por Origens Diferentes
| Step | Checklist | Status | Notas |
|:---|:---|:---:|:---|
| 1 | Remessa CLT segregada | PENDENTE | Não agrupa RHID com diaristas |
| 2 | Remessa Intermitente segregada | PENDENTE | Não agrupa com outros perfis |
| 3 | Remessa Diarista segregada | PENDENTE | |
| 4 | Nenhum arquivo mistura tenant | PENDENTE | |
| 5 | Nenhum arquivo mistura empresa | PENDENTE | |
| 6 | Nenhum arquivo mistura ambiente | PENDENTE | |

---

### Cenário E — Imutabilidade e Governança
| Step | Checklist | Status | Notas |
|:---|:---|:---:|:---|
| 1 | Remessa GERADA não permite alteração de itens | PENDENTE | Trigger Before Update bloqueia mutação manual |
| 2 | Remessa ENVIADA não permt alteração de valor/hash | PENDENTE | Trigger ativo |
| 3 | Mudança exige cancelamento formal e nova remessa | PENDENTE | Status = CANCELADO para release do batch original (se aplicavel) |

### CONCLUSÃO FINAL: 
- [ ] SMOKE BANCÁRIO APROVADO (GO FINAL)
