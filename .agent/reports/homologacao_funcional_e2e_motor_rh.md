# Relatório Executivo de Homologação E2E — Motor RH (CLT)

## 📌 Veredito Estrutural
O Motor RH pode ser considerado homologado para produção?
**🔴 NÃO. REPROVADO.**

Foram detectados bugs críticos na **Camada Matemática de Cálculo de Banco de Horas / Compensação**, especificamente na aplicação de Tolerâncias CLT (Atraso e Hora Extra), que inviabilizam a liberação para o ambiente financeiro (DRE/CNAB) devido a prejuízos contábeis diários (Perda fantasma de minutos). 

---

## 🔬 Tabela Comparativa de Homologação Funcional

| Massa (Colaborador) | Cenário | Expectativa (Minutos Resultantes) | Cálculo do Motor (Atual) | Status |
|---|---|---|---|---|
| **HML-001** | Jornada Normal | Saldo/Extra: 0 | Saldo/Extra: 0 | ✅ APROVADO |
| **HML-002** | Hora Extra (2h) | `minutosExtra`: 120 | `minutosExtra`: 110 | 🔴 REPROVADO |
| **HML-003** | Atraso (30m) | `minutosDebito`: 30 | `minutosDebito`: 20 | 🔴 REPROVADO |
| **HML-003** | Atraso (5m) | `minutosDebito`: 0 (Tolerância = 10m) | `minutosDebito`: 0 | ✅ APROVADO |
| **HML-004** | Incompleto (Falta Saída)| SaldoBase: -480 / Debito: 480 | `minutosDebito`: 470 | 🔴 REPROVADO |
| **HML-005** | Ausência / Falta | Desconto financeiro / Débito: 480 | Débito: 480 | ✅ APROVADO |

---

## 🚫 Bug Matemático Encontrado (Critical)

No arquivo `src/services/rhProcessing.service.ts`, o bloco de `calculateCompensation` falha sistematicamente na interpretação de excedentes e faltas mediante tolerância:

```typescript
// COMO ESTÁ NO SISTEMA ATUALMENTE:
if (saldoBase > toleranciaExtra) {
    minutosExtra = Math.min(saldoBase - toleranciaExtra, limiteDiarioBanco);
} else if (saldoBase < 0) {
    minutosDebito = Math.abs(saldoBase) > toleranciaAtraso ? Math.abs(saldoBase) - toleranciaAtraso : 0;
}
```

### 💣 Impacto do Bug:
A Tolerância Trabalhista (Art. 58, § 1º, da CLT – 10 minutos) determina que **variações DE ATÉ 10 minutos não são computadas**. Porém, se o colaborador exceder essa tolerância (ex: 30 minutos extras), ele deve receber/dever **pelos 30 minutos inteiros**, e não apenas pelo valor remanescente fora da tolerância (30-10 = 20). 

**Atualmente o Motor RH está sistematicamente ROUBANDO 10 minutos diários de qualquer funcionário que faz mais de 10 minutos de hora extra, e PERDOANDO 10 minutos de qualquer atraso superior a 10 minutos.**

### 🛠️ Correção Necessária (Solução/Patch sugerido):
Alterar a lógica para computar o saldo total em caso de estouro:
```typescript
// COMO DEVE FICAR (Exemplo para correção posterior):
if (saldoBase > toleranciaExtra) {
    // Se a tolerância for ultrapassada, o funcionário tem direito a 100% da extra.
    minutosExtra = Math.min(saldoBase, limiteDiarioBanco);
} else if (saldoBase < (-toleranciaAtraso)) {
    // Se a tolerância de atraso for ultrapassada, perde-se o tempo integral do atraso.
    minutosDebito = Math.abs(saldoBase);
}
```

---

## 🛡️ Aspectos Aprovados

1. **Idempotência & OCC:** A mecânica de `replaceRhEventoByRegistro` com `Upserts` protege a camada do banco de horas contra dupla contabilização durante repetições, confirmando as regras de Soft-Delete / Upsert.
2. **Isolamento Multi-tenant e Cadastral:** Colaboradores `DIARISTAS` e provisórios são devidamente capturados nas travas operacionais de `validateColaboradorApto`, não poluindo cálculos.
3. **Detecção de Fraudes / Inconsistências:** O Motor intercepta perfeitamente batidas ímpares e intervalos menores que 0, impedindo emissão financeira fraudulenta em `buildInconsistencias`.

---

## 📋 Lista de Inconsistências (Ações)
1. 🔴 **CRÍTICA:** Bug da subtração contínua das tolerâncias diárias no processamento de horas.
2. 🟡 **MÉDIA:** Excesso Financeiro (`EXTRA_RATE` cravado em 1.5/50%). Requer uma parametrização de banco de dados caso contratos prevejam domingos/feriados em 100% (Adicional Especial - Acompanhar no futuro).
3. 🟡 **MÉDIA:** Atualização de saldos utilizando UI em vez de trigger transacional pura. No entanto, é compensado pela reatividade frontend e não afeta imediatamente os relatórios, desde que não existam edições concorrentes de pontas remotas (Safe System).

## 🚀 Próximos Passos
Asseguro que a suspensão da HOMOLOGAÇÃO só recai sobre a correção do Bug Matemático Crítico. Aguardo aprovação do escopo para submeter a correção ao `rhProcessing.service.ts` e finalizar a esteira de Motor RH para avanço rumo ao pipeline **Financeiro e CNAB**.
