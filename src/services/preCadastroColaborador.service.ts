import { supabase } from "@/lib/supabase";

type ColaboradorLookup = {
  id: string;
  tenant_id?: string | null;
  empresa_id?: string | null;
  nome?: string | null;
  cpf?: string | null;
  matricula?: string | null;
  cargo?: string | null;
  tipo_colaborador?: string | null;
  status?: string | null;
  status_cadastro?: string | null;
};

export type PontoPreCadastroRow = {
  colaborador_id?: string | null;
  empresa_id?: string | null;
  nome_colaborador?: string | null;
  cpf_colaborador?: string | null;
  matricula_colaborador?: string | null;
  cargo_colaborador?: string | null;
};

type EnsurePreCadastrosResult<T> = {
  rowsWithColaboradorId: T[];
  novosDetectados: number;
  preCadastrosCriados: number;
};

const LEGACY_ORIGIN = "importacao_ponto";
const PRE_CADASTRO_STATUS = "pendente_complemento";

const normalizeCpf = (value?: string | null) => String(value ?? "").replace(/\D/g, "").trim();

const normalizeMatricula = (value?: string | null) => String(value ?? "").trim();

async function getCurrentTenantId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error("Sessao invalida. Faca login novamente para continuar.");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (error || !profile?.tenant_id) {
    throw new Error("Usuario sem tenant associado. Contate o administrador.");
  }

  return profile.tenant_id;
}

const buildMaps = (colaboradores: ColaboradorLookup[]) => {
  const byCpf = new Map<string, ColaboradorLookup>();
  const byMatricula = new Map<string, ColaboradorLookup>();

  for (const colaborador of colaboradores) {
    const cpf = normalizeCpf(colaborador.cpf);
    const matricula = normalizeMatricula(colaborador.matricula);

    if (cpf) {
      byCpf.set(cpf, colaborador);
    }

    if (matricula) {
      byMatricula.set(matricula, colaborador);
    }
  }

  return { byCpf, byMatricula };
};

const findExistingColaborador = (
  row: Pick<PontoPreCadastroRow, "cpf_colaborador" | "matricula_colaborador">,
  maps: ReturnType<typeof buildMaps>,
) => {
  const cpf = normalizeCpf(row.cpf_colaborador);
  const matricula = normalizeMatricula(row.matricula_colaborador);

  if (cpf && maps.byCpf.has(cpf)) {
    return maps.byCpf.get(cpf) ?? null;
  }

  if (matricula && maps.byMatricula.has(matricula)) {
    return maps.byMatricula.get(matricula) ?? null;
  }

  return null;
};

const createPreCadastro = async ({
  tenantId,
  empresaId,
  nome,
  cpf,
  matricula,
  cargo,
  origemDetalhe,
}: {
  tenantId: string;
  empresaId: string;
  nome: string;
  cpf?: string | null;
  matricula?: string | null;
  cargo?: string | null;
  origemDetalhe: string;
}) => {
  const payload = {
    tenant_id: tenantId,
    empresa_id: empresaId,
    nome: nome.trim(),
    cpf: normalizeCpf(cpf) || null,
    matricula: normalizeMatricula(matricula) || null,
    cargo: cargo?.trim() || null,
    telefone: null,
    valor_base: null,
    tipo_contrato: null,
    tipo_colaborador: "CLT",
    status: "pendente",
    status_cadastro: PRE_CADASTRO_STATUS,
    origem: LEGACY_ORIGIN,
    origem_cadastro: "ponto_importado",
    origem_detalhe: origemDetalhe,
    cadastro_provisorio: true,
    permitir_lancamento_operacional: false,
  };

  const { data, error } = await (supabase as any)
    .from("colaboradores")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ColaboradorLookup;
};

export async function ensurePreCadastroColaboradorFromPonto(params: {
  tenantId?: string;
  empresaId: string;
  nome: string;
  cpf?: string | null;
  matricula?: string | null;
  cargo?: string | null;
  origemDetalhe?: string;
  colaboradoresExistentes?: ColaboradorLookup[];
}): Promise<ColaboradorLookup | null> {
  const nome = params.nome.trim();
  if (!nome || !params.empresaId) {
    return null;
  }

  const cpf = normalizeCpf(params.cpf);
  const matricula = normalizeMatricula(params.matricula);
  if (!cpf && !matricula) {
    return null;
  }

  const tenantId = params.tenantId || (await getCurrentTenantId());
  let colaboradores = params.colaboradoresExistentes;

  if (!colaboradores) {
    const { data, error } = await (supabase as any)
      .from("colaboradores")
      .select("id, tenant_id, empresa_id, nome, cpf, matricula, cargo, tipo_colaborador, status, status_cadastro")
      .eq("tenant_id", tenantId);

    if (error) {
      throw error;
    }

    colaboradores = (data ?? []) as ColaboradorLookup[];
  }

  const existente = findExistingColaborador(
    {
      cpf_colaborador: cpf,
      matricula_colaborador: matricula,
    },
    buildMaps(colaboradores),
  );

  if (existente) {
    return existente;
  }

  return createPreCadastro({
    tenantId,
    empresaId: params.empresaId,
    nome,
    cpf,
    matricula,
    cargo: params.cargo,
    origemDetalhe: params.origemDetalhe || "planilha",
  });
}

export async function ensurePreCadastrosFromImportedPontos<T extends PontoPreCadastroRow>(
  rows: T[],
  origemDetalhe = "planilha",
): Promise<EnsurePreCadastrosResult<T>> {
  if (rows.length === 0) {
    return {
      rowsWithColaboradorId: rows,
      novosDetectados: 0,
      preCadastrosCriados: 0,
    };
  }

  const tenantId = await getCurrentTenantId();
  const { data, error } = await (supabase as any)
    .from("colaboradores")
    .select("id, tenant_id, empresa_id, nome, cpf, matricula, cargo, tipo_colaborador, status, status_cadastro")
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }

  const colaboradores = (data ?? []) as ColaboradorLookup[];
  const maps = buildMaps(colaboradores);
  const cache = new Map<string, ColaboradorLookup | null>();
  const rowsWithColaboradorId: T[] = [];
  let novosDetectados = 0;
  let preCadastrosCriados = 0;

  for (const row of rows) {
    if (row.colaborador_id) {
      rowsWithColaboradorId.push(row);
      continue;
    }

    const nome = row.nome_colaborador?.trim() || "";
    const empresaId = row.empresa_id || null;
    const cpf = normalizeCpf(row.cpf_colaborador);
    const matricula = normalizeMatricula(row.matricula_colaborador);
    const dedupeKey = cpf ? `cpf:${cpf}` : matricula ? `matricula:${matricula}` : "";

    if (!nome || !empresaId || !dedupeKey) {
      rowsWithColaboradorId.push(row);
      continue;
    }

    let resolved = cache.get(dedupeKey) ?? null;

    if (!cache.has(dedupeKey)) {
      const existente = findExistingColaborador(row, maps);

      if (existente) {
        resolved = existente;
      } else {
        novosDetectados += 1;
        resolved = await createPreCadastro({
          tenantId,
          empresaId,
          nome,
          cpf,
          matricula,
          cargo: row.cargo_colaborador,
          origemDetalhe,
        });
        preCadastrosCriados += 1;
        colaboradores.push(resolved);

        if (cpf) {
          maps.byCpf.set(cpf, resolved);
        }

        if (matricula) {
          maps.byMatricula.set(matricula, resolved);
        }
      }

      cache.set(dedupeKey, resolved);
    }

    rowsWithColaboradorId.push({
      ...row,
      colaborador_id: resolved?.id ?? row.colaborador_id ?? null,
    });
  }

  return {
    rowsWithColaboradorId,
    novosDetectados,
    preCadastrosCriados,
  };
}
