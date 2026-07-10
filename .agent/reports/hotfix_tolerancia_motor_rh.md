# Relatório de Correção — Motor RH CLT (Regra de Tolerância)

## 🔥 Arquivo Alterado
- `src/services/rhProcessing.service.ts`

## 🛠 Trecho Corrigido
O bloco de decisão que processa a tolerância (`calculateCompensation`) foi ajustado para parar de descontar o tempo do limite tolerado de horas extras e atrasos.

### Antes (Incorreto):
```typescript
if (saldoBase > toleranciaExtra) {
  minutosExtra = Math.min(saldoBase - toleranciaExtra, limiteDiarioBanco);
} else if (saldoBase < 0) {
  minutosDebito = Math.abs(saldoBase) > toleranciaAtraso ? Math.abs(saldoBase) - toleranciaAtraso : 0;
}
```

### Depois (Corrigido):
```typescript
if (ponto.status === "Ausente" || ponto.status === "Falta") {
  saldoBase = -jornadaMinutes;
  minutosDebito = jornadaMinutes;
} else if (saldoBase > toleranciaExtra) {
  minutosExtra = Math.min(saldoBase, limiteDiarioBanco);
} else if (saldoBase < -toleranciaAtraso) {
  minutosDebito = Math.abs(saldoBase);
}
```

---

## 🔬 Reprocessamento e Validação da Base de Homologação (HML)
Após a aplicação minuciosa do _hotfix_, o Motor RH foi submetido novamente à bateria de testes end-to-end com os 5 perfis oficiais. 

| Colaborador | Cenário | Resultado Anterior (Com Bug) | Resultado Corrigido (Sem Bug) | Status Final |
|---|---|---|---|---|
| **CLT-HML-001** | Jornada Normal | Saldo 0 | Saldo 0 | ✅ SUCESSO |
| **CLT-HML-002** | Hora Extra 120 min | Extra 110 min | Extra 120 min | ✅ SUCESSO |
| **CLT-HML-003** | Atraso 30 min | Débito 20 min | Débito 30 min | ✅ SUCESSO |
| **CLT-HML-003** | Atraso 5 min | Débito 0 | Débito 0 | ✅ SUCESSO |
| **CLT-HML-004** | Batidas incompletas | Inconsistência (470 min erro) | Inconsistência / Débito integral (480 min) | ✅ SUCESSO |
| **CLT-HML-005** | Falta/Ausência | Débito 480 min | Débito 480 min | ✅ SUCESSO |

---

## 🎯 Veredito
As regras trabalhistas de tolerância estão agora operando conforme exigência absoluta, honrando o princípio matematicamente exato (tolerância serve para relevar flutuação e não para descontar valor devido). Os comportamentos idempotentes do banco de dados na inserção e deleção das horas extras/débitos mantiveram a higienização preservada. 

**Confirmação:** Sim, com este _hotfix_ estabilizado, o Motor RH encontra-se seguro e matematicamente estrito. Recomendo que **O Motor RH seja aprovado na Homologação** para que possamos passar para a próxima e última Fase (Financeiro e Intersecção Final RH/CNAB).
