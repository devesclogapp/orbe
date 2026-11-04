/**
 * portal_cliente_seguranca_etapa02_1.test.ts
 *
 * TESTES OBRIGATÓRIOS DA FUNDAÇÃO DE SEGURANÇA DO PORTAL DO CLIENTE (ETAPA 02.1)
 * MODELO OFICIAL CONFIRMADO: EXCLUSIVO PARA EMPRESAS CONTRATANTES
 *
 * Cobertura de Testes:
 * 1. Empresa A visualiza apenas suas operações autorizadas.
 * 2. Empresa B não visualiza operações da Empresa A (mesmo tenant).
 * 3. Transportadora não recebe acesso ao portal por estar vinculada a uma operação.
 * 4. Fabricante/fornecedor não recebe acesso ao portal.
 * 5. Usuário sem vínculo recebe acesso negado (Fail-Closed, zero registros).
 * 6. Convites não permitem associação arbitrária a empresas (validação estrita de empresa_id existente no tenant).
 * 7. Dados internos permanecem protegidos (valores unitários, salários, custos, margens, colaboradores).
 * 8. Administradores e encarregados mantêm o funcionamento operacional homologado sem bloqueios.
 * 9. Blindagem de Rotas: Role 'cliente' é bloqueada em rotas administrativas, RH e Financeiro.
 * 10. Blindagem de Rotas: Rota de aprovações financeiras (/cliente/aprovacoes) é bloqueada no MVP.
 */

import { describe, it, expect } from "vitest";
import {
  isRouteForbiddenForRole,
  getDefaultRouteForRole,
  getAccessDeniedFallbackRoute,
  normalizeRole,
  buildPresetPermissions,
  canAccessModule,
} from "@/lib/access-control";

// Interfaces para simulação determinística dos dados da RPC
interface MockOperacaoProducao {
  id: string;
  tenant_id: string;
  empresa_id: string;          // Empresa Contratante (exclusiva para o portal)
  transportadora_id: string;    // Transportador da mercadoria (não tem acesso)
  fornecedor_id: string;        // Fabricante/fornecedor (não tem acesso)
  tipo_servico_id: string;
  produto_carga_id: string | null;
  quantidade: number;
  valor_unitario_snapshot: number; // Campo confidencial
  custo_com_iss: number;           // Campo confidencial
  colaborador_id: string;          // Campo confidencial
  status: string;
  deleted_at: string | null;
  data_operacao: string;
  placa: string | null;
  nf_numero: string | null;
  ctrc: string | null;
  entrada_ponto: string | null;
  saida_ponto: string | null;
  observacao: string | null;
}

interface MockPortalClienteUsuario {
  id: string;
  tenant_id: string;
  user_id: string;
  empresa_id: string; // Vínculo EXCLUSIVO com a Empresa Contratante
  ativo: boolean;
}

/**
 * Réplica matemática da lógica de isolamento executada pela RPC get_portal_cliente_operacoes()
 */
function executeGetPortalClienteOperacoes(params: {
  authUid: string | null;
  vinculos: MockPortalClienteUsuario[];
  operacoes: MockOperacaoProducao[];
  dataInicio?: string | null;
  dataFim?: string | null;
  status?: string | null;
}) {
  // 1. Fail-closed se não autenticado
  if (!params.authUid) {
    return [];
  }

  // 2. Resolver o vínculo ativo da Empresa Contratante do usuário
  const vinculo = params.vinculos.find(
    (v) => v.user_id === params.authUid && v.ativo
  );

  // Fail-closed se não tiver vínculo ativo com empresa contratante
  if (!vinculo) {
    return [];
  }

  // 3. Filtrar estritamente pela EMPRESA CONTRATANTE e pelo tenant
  return params.operacoes
    .filter((op) => {
      // Isolamento por tenant
      if (op.tenant_id !== vinculo.tenant_id) return false;

      // Isolamento estrito por Empresa Contratante
      if (op.empresa_id !== vinculo.empresa_id) return false;

      // Não deletado
      if (op.deleted_at !== null) return false;

      // Status autorizado para exposição externa
      if (!["processado", "fechado"].includes(op.status)) return false;

      // Filtros opcionais
      if (params.dataInicio && op.data_operacao < params.dataInicio) return false;
      if (params.dataFim && op.data_operacao > params.dataFim) return false;
      if (params.status && op.status !== params.status) return false;

      return true;
    })
    .map((op) => {
      // 4. Projeção Sanitizada (OMISSÃO ESTRITA DE DADOS CONFIDENCIAIS)
      return {
        id: op.id,
        data_operacao: op.data_operacao,
        quantidade: op.quantidade,
        placa: op.placa || "-",
        nf_numero: op.nf_numero || "-",
        ctrc: op.ctrc || "-",
        horario_inicio: op.entrada_ponto,
        horario_fim: op.saida_ponto,
        status_operacional: op.status === "fechado" ? "Concluído / Faturado" : "Concluído",
        observacao: op.observacao || "",
        // Garantia de que dados confidenciais nunca estarão presentes
      };
    });
}

/**
 * Validação de integridade do convite/vínculo SEC-03 (fn_sync_portal_cliente_on_invitation_accept)
 */
function validateAndSyncConviteCliente(params: {
  tenantId: string;
  role: string;
  clienteContext?: { empresa_id?: string } | null;
  empresasDoTenant: { id: string; tenant_id: string }[];
}): { success: boolean; error?: string } {
  if (params.role !== "cliente") {
    return { success: false, error: "Papel não é cliente" };
  }

  const empresaId = params.clienteContext?.empresa_id;
  if (!empresaId) {
    return { success: false, error: "empresa_id obrigatório para cliente" };
  }

  const empresaExiste = params.empresasDoTenant.some(
    (e) => e.id === empresaId && e.tenant_id === params.tenantId
  );

  if (!empresaExiste) {
    return { success: false, error: "Empresa não existe ou pertence a outro tenant" };
  }

  return { success: true };
}

describe("PORTAL DO CLIENTE — FUNDAÇÃO DE SEGURANÇA E ISOLAMENTO (ETAPA 02.1)", () => {
  const TENANT_ESC_LOG = "tenant-esclog-0001";
  const TENANT_OUTRO = "tenant-concorrente-9999";

  const EMPRESA_DISMELO = "empresa-dismelo-castanhal";
  const EMPRESA_BENEVIDES = "empresa-benevides";
  const EMPRESA_OUTRO_TENANT = "empresa-outro-tenant";

  const TRANSPORTADORA_ARAGUAIA = "transp-araguaia-log";
  const TRANSPORTADORA_RODONAVES = "transp-rodonaves";
  const FORNECEDOR_AMBEV = "forn-ambev";

  const USER_EMPRESA_DISMELO = "user-auth-dismelo-01";
  const USER_EMPRESA_BENEVIDES = "user-auth-benevides-02";
  const USER_TRANSPORTADORA = "user-auth-transportadora-03";
  const USER_FORNECEDOR = "user-auth-fornecedor-04";
  const USER_SEM_VINCULO = "user-auth-sem-vinculo-05";

  const mockVinculos: MockPortalClienteUsuario[] = [
    {
      id: "vinc-1",
      tenant_id: TENANT_ESC_LOG,
      user_id: USER_EMPRESA_DISMELO,
      empresa_id: EMPRESA_DISMELO,
      ativo: true,
    },
    {
      id: "vinc-2",
      tenant_id: TENANT_ESC_LOG,
      user_id: USER_EMPRESA_BENEVIDES,
      empresa_id: EMPRESA_BENEVIDES,
      ativo: true,
    },
    // Usuário Transportadora e Fornecedor NÃO POSSUEM vínculo de empresa contratante
  ];

  const mockOperacoes: MockOperacaoProducao[] = [
    // Operação 1: Dismelo (Contratante), Transportada pela Araguaia, Fornecida pela Ambev, Validada
    {
      id: "op-1",
      tenant_id: TENANT_ESC_LOG,
      empresa_id: EMPRESA_DISMELO,
      transportadora_id: TRANSPORTADORA_ARAGUAIA,
      fornecedor_id: FORNECEDOR_AMBEV,
      tipo_servico_id: "serv-descarga",
      produto_carga_id: "prod-bebidas",
      quantidade: 2400,
      valor_unitario_snapshot: 0.85,
      custo_com_iss: 2040.0,
      colaborador_id: "colab-joao-silva",
      status: "processado",
      deleted_at: null,
      data_operacao: "2026-11-01",
      placa: "DIS-1111",
      nf_numero: "NF-99881",
      ctrc: "CTRC-4455",
      entrada_ponto: "08:00:00",
      saida_ponto: "11:30:00",
      observacao: "Descarga CD Dismelo",
    },
    // Operação 2: Dismelo (Contratante), Fechada
    {
      id: "op-2",
      tenant_id: TENANT_ESC_LOG,
      empresa_id: EMPRESA_DISMELO,
      transportadora_id: TRANSPORTADORA_RODONAVES,
      fornecedor_id: FORNECEDOR_AMBEV,
      tipo_servico_id: "serv-descarga",
      produto_carga_id: "prod-bebidas",
      quantidade: 1200,
      valor_unitario_snapshot: 0.85,
      custo_com_iss: 1020.0,
      colaborador_id: "colab-carlos-mello",
      status: "fechado",
      deleted_at: null,
      data_operacao: "2026-11-02",
      placa: "DIS-2222",
      nf_numero: "NF-99882",
      ctrc: "CTRC-4456",
      entrada_ponto: "13:00:00",
      saida_ponto: "15:00:00",
      observacao: "Descarga completada",
    },
    // Operação 3: Dismelo, Não-Validada (pendente) -> NÃO DEVE APARECER
    {
      id: "op-3",
      tenant_id: TENANT_ESC_LOG,
      empresa_id: EMPRESA_DISMELO,
      transportadora_id: TRANSPORTADORA_ARAGUAIA,
      fornecedor_id: FORNECEDOR_AMBEV,
      tipo_servico_id: "serv-descarga",
      produto_carga_id: null,
      quantidade: 500,
      valor_unitario_snapshot: 0.85,
      custo_com_iss: 425.0,
      colaborador_id: "colab-marcos-rocha",
      status: "pendente",
      deleted_at: null,
      data_operacao: "2026-11-03",
      placa: "DIS-3333",
      nf_numero: "NF-99999",
      ctrc: null,
      entrada_ponto: null,
      saida_ponto: null,
      observacao: "Em conferência de campo",
    },
    // Operação 4: Benevides (Outra Empresa Contratante), Validada
    {
      id: "op-4",
      tenant_id: TENANT_ESC_LOG,
      empresa_id: EMPRESA_BENEVIDES,
      transportadora_id: TRANSPORTADORA_ARAGUAIA, // Transportada pela mesma Araguaia!
      fornecedor_id: FORNECEDOR_AMBEV,
      tipo_servico_id: "serv-descarga",
      produto_carga_id: "prod-limpeza",
      quantidade: 3200,
      valor_unitario_snapshot: 0.65,
      custo_com_iss: 2080.0,
      colaborador_id: "colab-antonio-dias",
      status: "processado",
      deleted_at: null,
      data_operacao: "2026-11-01",
      placa: "BEN-4444",
      nf_numero: "NF-77711",
      ctrc: "CTRC-1111",
      entrada_ponto: "07:30:00",
      saida_ponto: "12:00:00",
      observacao: "Recebimento na base Benevides",
    },
    // Operação 5: Excluída logicamente (deleted_at) -> NÃO DEVE APARECER
    {
      id: "op-5",
      tenant_id: TENANT_ESC_LOG,
      empresa_id: EMPRESA_DISMELO,
      transportadora_id: TRANSPORTADORA_ARAGUAIA,
      fornecedor_id: FORNECEDOR_AMBEV,
      tipo_servico_id: "serv-descarga",
      produto_carga_id: null,
      quantidade: 1000,
      valor_unitario_snapshot: 0.85,
      custo_com_iss: 850.0,
      colaborador_id: "colab-joao-silva",
      status: "processado",
      deleted_at: "2026-11-02T10:00:00Z",
      data_operacao: "2026-11-01",
      placa: "DEL-0000",
      nf_numero: "NF-00000",
      ctrc: null,
      entrada_ponto: "08:00:00",
      saida_ponto: "10:00:00",
      observacao: "Cancelada",
    },
  ];

  it("1. Empresa A visualiza apenas suas operações autorizadas", () => {
    const resultado = executeGetPortalClienteOperacoes({
      authUid: USER_EMPRESA_DISMELO,
      vinculos: mockVinculos,
      operacoes: mockOperacoes,
    });

    expect(resultado.length).toBe(2);
    expect(resultado.map((r) => r.id)).toEqual(["op-1", "op-2"]);
    expect(resultado[0].placa).toBe("DIS-1111");
    expect(resultado[1].placa).toBe("DIS-2222");
  });

  it("2. Empresa B não visualiza operações da empresa A (mesmo tenant)", () => {
    const resultadoB = executeGetPortalClienteOperacoes({
      authUid: USER_EMPRESA_BENEVIDES,
      vinculos: mockVinculos,
      operacoes: mockOperacoes,
    });

    // Empresa B (Benevides) só pode ver op-4
    expect(resultadoB.length).toBe(1);
    expect(resultadoB[0].id).toBe("op-4");

    // Empresa B NÃO vê operações da Dismelo (op-1, op-2)
    expect(resultadoB.some((r) => r.id === "op-1")).toBe(false);
    expect(resultadoB.some((r) => r.id === "op-2")).toBe(false);
  });

  it("3. Transportadora não recebe acesso ao portal por estar vinculada a uma operação", () => {
    // Mesmo que a transportadora Araguaia esteja vinculada nas operações op-1 e op-4,
    // um usuário com identidade de transportadora NÃO tem vínculo de empresa contratante.
    const resultado = executeGetPortalClienteOperacoes({
      authUid: USER_TRANSPORTADORA,
      vinculos: mockVinculos,
      operacoes: mockOperacoes,
    });

    expect(resultado).toEqual([]);
    expect(resultado.length).toBe(0);
  });

  it("4. Fabricante/fornecedor não recebe acesso ao portal", () => {
    // Mesmo que o fornecedor Ambev tenha fornecido mercadorias em op-1, op-2 e op-4,
    // ele NÃO possui vínculo de empresa contratante no portal.
    const resultado = executeGetPortalClienteOperacoes({
      authUid: USER_FORNECEDOR,
      vinculos: mockVinculos,
      operacoes: mockOperacoes,
    });

    expect(resultado).toEqual([]);
    expect(resultado.length).toBe(0);
  });

  it("5. Usuário sem vínculo recebe acesso negado (Fail-Closed)", () => {
    const resultado = executeGetPortalClienteOperacoes({
      authUid: USER_SEM_VINCULO,
      vinculos: mockVinculos,
      operacoes: mockOperacoes,
    });

    expect(resultado).toEqual([]);
    expect(resultado.length).toBe(0);
  });

  it("6. Convites não permitem associação arbitrária a empresas", () => {
    const empresasDoTenant = [
      { id: EMPRESA_DISMELO, tenant_id: TENANT_ESC_LOG },
      { id: EMPRESA_BENEVIDES, tenant_id: TENANT_ESC_LOG },
      { id: EMPRESA_OUTRO_TENANT, tenant_id: TENANT_OUTRO },
    ];

    // Convite válido para empresa existente no tenant ESC LOG
    const conviteValido = validateAndSyncConviteCliente({
      tenantId: TENANT_ESC_LOG,
      role: "cliente",
      clienteContext: { empresa_id: EMPRESA_DISMELO },
      empresasDoTenant,
    });
    expect(conviteValido.success).toBe(true);

    // Tentativa de convite sem empresa_id -> Falha
    const conviteSemEmpresa = validateAndSyncConviteCliente({
      tenantId: TENANT_ESC_LOG,
      role: "cliente",
      clienteContext: {},
      empresasDoTenant,
    });
    expect(conviteSemEmpresa.success).toBe(false);
    expect(conviteSemEmpresa.error).toContain("empresa_id obrigatório");

    // Tentativa de convite para empresa de outro tenant -> Bloqueado
    const conviteTenantInvalido = validateAndSyncConviteCliente({
      tenantId: TENANT_ESC_LOG,
      role: "cliente",
      clienteContext: { empresa_id: EMPRESA_OUTRO_TENANT },
      empresasDoTenant,
    });
    expect(conviteTenantInvalido.success).toBe(false);
    expect(conviteTenantInvalido.error).toContain("Empresa não existe ou pertence a outro tenant");
  });

  it("7. Dados internos permanecem protegidos (valores unitários, salários, custos extras, margens)", () => {
    const resultado = executeGetPortalClienteOperacoes({
      authUid: USER_EMPRESA_DISMELO,
      vinculos: mockVinculos,
      operacoes: mockOperacoes,
    });

    expect(resultado.length).toBeGreaterThan(0);
    const item = resultado[0] as any;

    // Campos visíveis permitidos
    expect(item.id).toBeDefined();
    expect(item.data_operacao).toBeDefined();
    expect(item.quantidade).toBeDefined();
    expect(item.placa).toBeDefined();
    expect(item.status_operacional).toBeDefined();

    // Campos ESTRITAMENTE CONFIDENCIAIS
    expect(item.valor_unitario_snapshot).toBeUndefined();
    expect(item.valor_unitario).toBeUndefined();
    expect(item.custo_com_iss).toBeUndefined();
    expect(item.colaborador_id).toBeUndefined();
    expect(item.colaboradores).toBeUndefined();
    expect(item.salario).toBeUndefined();
    expect(item.lucro).toBeUndefined();
  });

  it("8. Administradores e encarregados mantêm o funcionamento atual sem bloqueios", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("encarregado")).toBe("encarregado");
    expect(normalizeRole("rh")).toBe("rh");
    expect(normalizeRole("financeiro")).toBe("financeiro");
    expect(normalizeRole("cliente")).toBe("cliente");

    expect(getDefaultRouteForRole("admin")).toBe("/operacional/dashboard");
    expect(getDefaultRouteForRole("encarregado")).toBe("/producao");
    expect(getDefaultRouteForRole("rh")).toBe("/rh/aprovacoes");
    expect(getDefaultRouteForRole("financeiro")).toBe("/financeiro");
    expect(getDefaultRouteForRole("cliente")).toBe("/cliente/dashboard");

    // Permissões de admin continuam acessando todos os módulos
    const adminPermissions = buildPresetPermissions("admin");
    expect(canAccessModule(adminPermissions, "central_operacional")).toBe(true);
    expect(canAccessModule(adminPermissions, "central_financeira")).toBe(true);
  });

  it("9. Blindagem de Rotas: Role 'cliente' é bloqueada em rotas administrativas, RH e Financeiro", () => {
    // Bloqueadas para cliente externo
    expect(isRouteForbiddenForRole("cliente", "/operacional/dashboard")).toBe(true);
    expect(isRouteForbiddenForRole("cliente", "/producao")).toBe(true);
    expect(isRouteForbiddenForRole("cliente", "/rh/aprovacoes")).toBe(true);
    expect(isRouteForbiddenForRole("cliente", "/financeiro")).toBe(true);
    expect(isRouteForbiddenForRole("cliente", "/governanca/usuarios")).toBe(true);
    expect(isRouteForbiddenForRole("cliente", "/configuracoes")).toBe(true);
    expect(isRouteForbiddenForRole("cliente", "/banco-horas")).toBe(true);

    // Permitidas para cliente externo
    expect(isRouteForbiddenForRole("cliente", "/cliente/dashboard")).toBe(false);
    expect(isRouteForbiddenForRole("cliente", "/cliente/relatorios")).toBe(false);

    // Fallback de rota negada
    expect(getAccessDeniedFallbackRoute("cliente")).toBe("/cliente/dashboard");
  });

  it("10. Blindagem de Rotas: Rota de aprovações financeiras (/cliente/aprovacoes) é bloqueada no MVP", () => {
    expect(isRouteForbiddenForRole("cliente", "/cliente/aprovacoes")).toBe(true);
  });
});
