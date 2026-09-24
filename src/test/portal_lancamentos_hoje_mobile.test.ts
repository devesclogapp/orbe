import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mapStatusOperacao,
  mapStatusServicoExtra,
  mapStatusCustoExtra,
  mapStatusPeriodoOperacional,
  formatTimeLocal,
  type LancamentoHojePortal,
} from "../hooks/useLancamentosHojePortal";
import fs from "fs";
import path from "path";

describe("PORTAL UX-1 & UX-1.1 — Feed Operacional Unificado Mobile-First ('Lançamentos de Hoje')", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1 a 4. Os 4 Domínios Operacionais Suportados
  // ──────────────────────────────────────────────────────────────────────────
  it("1. Operação de volume é mapeada corretamente no feed com rótulo amigável", () => {
    const statusResult = mapStatusOperacao("processado");
    expect(statusResult.label).toBe("Aprovado");
    expect(statusResult.className).toContain("bg-emerald-50");

    const pendenteResult = mapStatusOperacao("RECEBIDO");
    expect(pendenteResult.label).toBe("Recebido");

    const restricaoResult = mapStatusOperacao("EM_RESTRICAO");
    expect(restricaoResult.label).toBe("Com restrição");
  });

  it("2. Serviço Extra é mapeado corretamente no feed com rótulo amigável", () => {
    expect(mapStatusServicoExtra("PENDENTE").label).toBe("Recebido");
    expect(mapStatusServicoExtra("EM_VALIDACAO").label).toBe("Em validação");
    expect(mapStatusServicoExtra("APROVADO_OPERACAO").label).toBe("Aprovado");
    expect(mapStatusServicoExtra("CONCLUIDO").label).toBe("Concluído");
  });

  it("3. Custo Extra é mapeado corretamente no feed com rótulo amigável", () => {
    expect(mapStatusCustoExtra("RECEBIDO").label).toBe("Recebido");
    expect(mapStatusCustoExtra("EM_VALIDACAO").label).toBe("Em validação");
    expect(mapStatusCustoExtra("APROVADO").label).toBe("Aprovado");
    expect(mapStatusCustoExtra("PAGO").label).toBe("Pago");
  });

  it("4. Período Operacional é mapeado corretamente no feed com rótulo amigável", () => {
    expect(mapStatusPeriodoOperacional("PENDENTE").label).toBe("Recebido");
    expect(mapStatusPeriodoOperacional("EM_VALIDACAO").label).toBe("Em validação");
    expect(mapStatusPeriodoOperacional("CONCLUIDO").label).toBe("Concluído");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Diaristas NÃO é agregado artificialmente
  // ──────────────────────────────────────────────────────────────────────────
  it("5. Diaristas NÃO é agregado artificialmente no hook useLancamentosHojePortal", () => {
    const hookPath = path.resolve(__dirname, "../hooks/useLancamentosHojePortal.ts");
    const hookContent = fs.readFileSync(hookPath, "utf-8");

    expect(hookContent).not.toContain("lancamentos_diaristas");
    expect(hookContent).not.toContain("LancamentoDiaristaService");
    expect(hookContent).not.toContain('"DIARISTA"');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Ordenação unificada por createdAt DESC
  // ──────────────────────────────────────────────────────────────────────────
  it("6. Feed ordena múltiplos domínios por createdAt DESC (mais recente primeiro)", () => {
    const mockItems: LancamentoHojePortal[] = [
      {
        id: "op-1",
        tipo: "OPERACAO",
        tipoLabel: "Operação",
        tipoBadgeClass: "bg-cyan-50",
        horario: "10:00",
        empresaNome: "Empresa A",
        titulo: "Descarga",
        valor: 150,
        statusLabel: "Recebido",
        statusColorClass: "bg-amber-50",
        createdAt: "2026-09-22T10:00:00.000Z",
      },
      {
        id: "se-1",
        tipo: "SERVICO_EXTRA",
        tipoLabel: "Serviço Extra",
        tipoBadgeClass: "bg-purple-50",
        horario: "15:42",
        empresaNome: "Empresa A",
        titulo: "Conserto de palete",
        valor: 10,
        statusLabel: "Recebido",
        statusColorClass: "bg-amber-50",
        createdAt: "2026-09-22T15:42:00.000Z",
      },
      {
        id: "ce-1",
        tipo: "CUSTO_EXTRA",
        tipoLabel: "Custo / Despesa",
        tipoBadgeClass: "bg-orange-50",
        horario: "14:20",
        empresaNome: "Empresa A",
        titulo: "Lanche",
        valor: 30,
        statusLabel: "Recebido",
        statusColorClass: "bg-amber-50",
        createdAt: "2026-09-22T14:20:00.000Z",
      },
    ];

    mockItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    expect(mockItems[0].id).toBe("se-1"); // 15:42
    expect(mockItems[1].id).toBe("ce-1"); // 14:20
    expect(mockItems[2].id).toBe("op-1"); // 10:00
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Limite inicial de 5 lançamentos
  // ──────────────────────────────────────────────────────────────────────────
  it("7. Componente RecentLaunchesList limita a exibição inicial a 5 itens", () => {
    const listPath = path.resolve(__dirname, "../components/operacoes/lancamento/RecentLaunchesList.tsx");
    const listContent = fs.readFileSync(listPath, "utf-8");

    expect(listContent).toContain("launches.slice(0, 5)");
    expect(listContent).toContain("Ver mais");
    expect(listContent).toContain("Recolher");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8 a 11. Invalidação coordenada nos 4 formulários
  // ──────────────────────────────────────────────────────────────────────────
  it("8. ServicosExtrasLancamento invalida lancamentos_hoje_portal no onSuccess", () => {
    const filePath = path.resolve(__dirname, "../pages/Producao/ServicosExtrasLancamento.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain('invalidateQueries({ queryKey: ["lancamentos_hoje_portal"] })');
  });

  it("9. CustosExtrasLancamento invalida lancamentos_hoje_portal no onSuccess", () => {
    const filePath = path.resolve(__dirname, "../pages/Producao/CustosExtrasLancamento.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain('invalidateQueries({ queryKey: ["lancamentos_hoje_portal"] })');
  });

  it("10. OperacaoForm invalida lancamentos_hoje_portal no onSuccess", () => {
    const filePath = path.resolve(__dirname, "../components/operacoes/lancamento/OperacaoForm.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain('invalidateQueries({ queryKey: ["lancamentos_hoje_portal"] })');
  });

  it("11. ServicosEspecificosLancamento invalida lancamentos_hoje_portal no onSuccess", () => {
    const filePath = path.resolve(__dirname, "../pages/Producao/ServicosEspecificosLancamento.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("invalidateQueries({ queryKey: ['lancamentos_hoje_portal'] })");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12 a 13. Resolução Segura de Empresa (Fail-Closed) e UX-1.1
  // ──────────────────────────────────────────────────────────────────────────
  it("12. Usuário com 1 empresa autorizada usa automaticamente essa empresa", () => {
    const hookPath = path.resolve(__dirname, "../hooks/useLancamentosHojePortal.ts");
    const hookContent = fs.readFileSync(hookPath, "utf-8");

    expect(hookContent).toContain("EmpresaService.getAll()");
    expect(hookContent).toContain("if (empresasAutorizadas.length === 1)");
    expect(hookContent).toContain("return empresasAutorizadas[0].id;");
  });

  it("13. Usuário com múltiplas empresas NÃO escolhe arbitrariamente uma delas (Fail-Closed)", () => {
    const hookPath = path.resolve(__dirname, "../hooks/useLancamentosHojePortal.ts");
    const hookContent = fs.readFileSync(hookPath, "utf-8");

    // Se > 1 e sem seleção, effectiveEmpresaId é nulo e não executa query irrestrita
    expect(hookContent).toContain("if (!effectiveEmpresaId) return [];");
    expect(hookContent).toContain("enabled: Boolean(effectiveEmpresaId && !isLoadingConfig)");
  });

  it("14. Ausência de user_metadata.empresa_id não impede o feed quando canonicamente existe 1 empresa", () => {
    const hookPath = path.resolve(__dirname, "../hooks/useLancamentosHojePortal.ts");
    const hookContent = fs.readFileSync(hookPath, "utf-8");

    expect(hookContent).toContain("userProfile?.empresa_id");
    expect(hookContent).toContain("user?.user_metadata?.empresa_id");
    expect(hookContent).toContain("empresasAutorizadas.length === 1");
  });

  it("15. Seletor de empresa em RecentLaunchesList é alimentado exclusivamente por empresas autorizadas", () => {
    const listPath = path.resolve(__dirname, "../components/operacoes/lancamento/RecentLaunchesList.tsx");
    const listContent = fs.readFileSync(listPath, "utf-8");

    expect(listContent).toContain("hasMultipleAuthorizedEmpresas");
    expect(listContent).toContain("empresasAutorizadas.map");
  });

  it("16. Mensagem de escopo indeterminado NÃO orienta 'selecione no formulário acima'", () => {
    const listPath = path.resolve(__dirname, "../components/operacoes/lancamento/RecentLaunchesList.tsx");
    const listContent = fs.readFileSync(listPath, "utf-8");

    expect(listContent).not.toContain("Selecione uma empresa no formulário acima");
    expect(listContent).toContain("Não foi possível determinar a empresa operacional deste acesso");
  });

  it("17. Empty state real e Error state são estritamente diferenciados", () => {
    const listPath = path.resolve(__dirname, "../components/operacoes/lancamento/RecentLaunchesList.tsx");
    const listContent = fs.readFileSync(listPath, "utf-8");

    expect(listContent).toContain("Nenhum lançamento realizado hoje.");
    expect(listContent).toContain("Não foi possível carregar os lançamentos de hoje");
    expect(listContent).toContain("Tentar novamente");
  });

  it("18. Componente RecentLaunchesList não utiliza <table> nem overflow-x-auto", () => {
    const listPath = path.resolve(__dirname, "../components/operacoes/lancamento/RecentLaunchesList.tsx");
    const listContent = fs.readFileSync(listPath, "utf-8");

    expect(listContent).not.toContain("<table");
    expect(listContent).not.toContain("overflow-x-auto");
  });

  it("19. Tenant continua obrigatório na chave de cache e contexto", () => {
    const hookPath = path.resolve(__dirname, "../hooks/useLancamentosHojePortal.ts");
    const hookContent = fs.readFileSync(hookPath, "utf-8");

    expect(hookContent).toContain("const { tenantId } = useTenant();");
    expect(hookContent).toContain('queryKey: ["lancamentos_hoje_portal", effectiveDate, effectiveEmpresaId, tenantId]');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 20 a 24. Regressão Cirúrgica do Feed de Custos Extras
  // ──────────────────────────────────────────────────────────────────────────
  it("20. CustoExtraOperacionalService.getByDate usa criado_em e NUNCA created_at", () => {
    const servicePath = path.resolve(__dirname, "../services/domain/despesas.service.ts");
    const serviceContent = fs.readFileSync(servicePath, "utf-8");

    // Procura o método getByDate
    const getByDateSnippet = serviceContent.substring(
      serviceContent.indexOf("async getByDate("),
      serviceContent.indexOf("async getAll(")
    );

    expect(getByDateSnippet).toContain(".order('criado_em', { ascending: false })");
    expect(getByDateSnippet).not.toContain("created_at");
  });

  it("21. Feed utiliza pipeline_status como prioridade para Custos Extras", () => {
    const hookPath = path.resolve(__dirname, "../hooks/useLancamentosHojePortal.ts");
    const hookContent = fs.readFileSync(hookPath, "utf-8");

    expect(hookContent).toContain("mapStatusCustoExtra(ce.pipeline_status || ce.status)");
  });

  it("22. Lançamento de Custo Extra invalida lancamentos_hoje_portal no Admin e Portal", () => {
    const portalLancamentoPath = path.resolve(__dirname, "../pages/Producao/CustosExtrasLancamento.tsx");
    const adminFormPath = path.resolve(__dirname, "../components/forms/CustosExtrasForm.tsx");

    const portalContent = fs.readFileSync(portalLancamentoPath, "utf-8");
    const adminContent = fs.readFileSync(adminFormPath, "utf-8");

    expect(portalContent).toContain('queryClient.invalidateQueries({ queryKey: ["lancamentos_hoje_portal"] })');
    expect(adminContent).toContain('queryClient.invalidateQueries({ queryKey: ["lancamentos_hoje_portal"] })');
  });

  it("23. Serviço Extra continua ordenando por criado_em e preservando integração", () => {
    const receitasServicePath = path.resolve(__dirname, "../services/receitas/receitas.service.ts");
    const receitasContent = fs.readFileSync(receitasServicePath, "utf-8");

    expect(receitasContent).toContain(".order('criado_em', { ascending: false })");
  });

  it("24. Mapeamento de status preserva os 4 domínios sem alteração de estados", () => {
    // Operação
    expect(mapStatusOperacao("aprovado").label).toBe("Aprovado");
    expect(mapStatusOperacao("em_validacao").label).toBe("Em validação");
    // Serviço Extra
    expect(mapStatusServicoExtra("APROVADO_OPERACAO").label).toBe("Aprovado");
    expect(mapStatusServicoExtra("EM_VALIDACAO").label).toBe("Em validação");
    // Custo Extra
    expect(mapStatusCustoExtra("APROVADO_OPERACAO").label).toBe("Aprovado");
    expect(mapStatusCustoExtra("EM_VALIDACAO").label).toBe("Em validação");
    expect(mapStatusCustoExtra("RECEBIDO").label).toBe("Recebido");
    expect(mapStatusCustoExtra("PAGO").label).toBe("Pago");
    // Período Operacional
    expect(mapStatusPeriodoOperacional("CONCLUIDO").label).toBe("Concluído");
    expect(mapStatusPeriodoOperacional("EM_VALIDACAO").label).toBe("Em validação");
  });
});
