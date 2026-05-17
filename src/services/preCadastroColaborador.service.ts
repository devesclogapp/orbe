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
  empresa_nome?: string | null;
  nome_colaborador?: string | null;
  cpf_colaborador?: string | null;
  matricula_colaborador?: string | null;
  cargo_colaborador?: string | null;
};

type EmpresaLookup = {
  id: string;
  nome: string;
};

type EnsurePreCadastrosResult<T> = {
  rowsWithColaboradorId: T[];
  novosDetectados: number;
  preCadastrosCriados: number;
};

const LEGACY_ORIGIN = "ponto";
const PRE_CADASTRO_STATUS = "pendente_complemento";

const normalizeCpf = (value?: string | null) => String(value ?? "").replace(/\D/g, "").trim();

const normalizeMatricula = (value?: string | null) => String(value ?? "").trim();

const normalizeText = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeCompanyText = (value?: string | null) => {
  const normalized = normalizeText(value);
  return normalized
    .replace(/\b(ltda|me|eireli|sa|epp)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const buildEmpresaLookup = (empresas: EmpresaLookup[]) => {
  const map = new Map<string, EmpresaLookup>();
  for (const empresa of empresas) {
    const key = normalizeCompanyText(empresa.nome);
    if (key) {
      map.set(key, empresa);
    }
  }
  return map;
};

const findEmpresaByName = (
  nome: string,
  lookup: Map<string, EmpresaLookup>,
): EmpresaLookup | null => {
  const key = normalizeCompanyText(nome);
  if (!key) return null;

  // Exact match
  if (lookup.has(key)) return lookup.get(key)!;

  // Partial match (contains)
  for (const [candidate, empresa] of lookup) {
    if (
      candidate.includes(key) ||
      key.includes(candidate) ||
      candidate.replace(/\s/g, "").includes(key.replace(/\s/g, ""))
    ) {
      return empresa;
    }
  }

  return null;
};

const generatePlaceholderCnpj = (): string => {
  // Prefix "00000" makes it clearly identifiable as auto-generated.
  // Suffix uses timestamp + random to guarantee uniqueness.
  const ts = Date.now().toString().slice(-6);
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `00000${ts}${rand}`;
};

const createMinimalEmpresa = async (
  tenantId: string,
  nomeOriginal: string,
): Promise<EmpresaLookup> => {
  const nome = nomeOriginal.trim();
  const cnpjPlaceholder = generatePlaceholderCnpj();

  const payload = {
    tenant_id: tenantId,
    nome,
    cnpj: cnpjPlaceholder,
    status: "ativa",
    origem: "ponto",
    cadastro_provisorio: true,
  };

  const { data, error } = await (supabase as any)
    .from("empresas")
    .insert(payload)
    .select("id, nome")
    .single();

  if (error) {
    // If CNPJ collision (extremely unlikely), retry once with a new value
    if (error.code === "23505" && String(error.message ?? "").includes("cnpj")) {
      const retryPayload = { ...payload, cnpj: generatePlaceholderCnpj() };
      const { data: retryData, error: retryError } = await (supabase as any)
        .from("empresas")
        .insert(retryPayload)
        .select("id, nome")
        .single();

      if (retryError) throw retryError;
      return retryData as EmpresaLookup;
    }

    throw error;
  }

  return data as EmpresaLookup;
};

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
  const byNomeEmpresa = new Map<string, ColaboradorLookup>();
  const byNome = new Map<string, ColaboradorLookup>();

  for (const colaborador of colaboradores) {
    const cpf = normalizeCpf(colaborador.cpf);
    const matricula = normalizeMatricula(colaborador.matricula);
    const nomeNormalizado = normalizeText(colaborador.nome);

    if (cpf) {
      byCpf.set(cpf, colaborador);
    }

    if (matricula) {
      if (colaborador.empresa_id) {
        byMatricula.set(`${matricula}::${colaborador.empresa_id}`, colaborador);
      }
      byMatricula.set(matricula, colaborador);
    }

    if (nomeNormalizado) {
      if (colaborador.empresa_id) {
        byNomeEmpresa.set(`${nomeNormalizado}::${colaborador.empresa_id}`, colaborador);
      }
      byNome.set(nomeNormalizado, colaborador);
    }
  }

  return { byCpf, byMatricula, byNomeEmpresa, byNome };
};

const findExistingColaborador = (
  row: Pick<PontoPreCadastroRow, "cpf_colaborador" | "matricula_colaborador" | "nome_colaborador" | "empresa_id">,
  maps: ReturnType<typeof buildMaps>,
) => {
  const cpf = normalizeCpf(row.cpf_colaborador);
  const matricula = normalizeMatricula(row.matricula_colaborador);
  const nomeNormalizado = normalizeText(row.nome_colaborador);
  const empresaId = row.empresa_id;

  if (cpf && maps.byCpf.has(cpf)) {
    return maps.byCpf.get(cpf) ?? null;
  }

  if (matricula && empresaId && maps.byMatricula.has(`${matricula}::${empresaId}`)) {
    return maps.byMatricula.get(`${matricula}::${empresaId}`) ?? null;
  }

  if (matricula && maps.byMatricula.has(matricula)) {
    return maps.byMatricula.get(matricula) ?? null;
  }

  if (nomeNormalizado && empresaId && maps.byNomeEmpresa.has(`${nomeNormalizado}::${empresaId}`)) {
    return maps.byNomeEmpresa.get(`${nomeNormalizado}::${empresaId}`) ?? null;
  }

  if (nomeNormalizado && maps.byNome.has(nomeNormalizado)) {
    return maps.byNome.get(nomeNormalizado) ?? null;
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
    empresa_id: empresaId || null,
    nome: nome.trim(),
    cpf: normalizeCpf(cpf) || null,
    matricula: normalizeMatricula(matricula) || null,
    cargo: cargo?.trim() || null,
    telefone: null,
    valor_base: null,
    tipo_contrato: null,
    modelo_calculo: null,
    regime_trabalho: "CLT",
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
  if (!nome) {
    return null;
  }

  const cpf = normalizeCpf(params.cpf);
  const matricula = normalizeMatricula(params.matricula);
  const nomeNormalizado = normalizeText(nome);

  if (!cpf && !matricula && !nomeNormalizado) {
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
      nome_colaborador: nome,
      empresa_id: params.empresaId,
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

  // Load existing colaboradores
  const { data, error } = await (supabase as any)
    .from("colaboradores")
    .select("id, tenant_id, empresa_id, nome, cpf, matricula, cargo, tipo_colaborador, status, status_cadastro")
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }

  // Load existing empresas for name-based resolution
  const { data: empresasData, error: empresasError } = await (supabase as any)
    .from("empresas")
    .select("id, nome")
    .eq("tenant_id", tenantId);

  if (empresasError) {
    throw empresasError;
  }

  const empresas = (empresasData ?? []) as EmpresaLookup[];
  const empresaLookup = buildEmpresaLookup(empresas);
  const empresaCreateCache = new Map<string, EmpresaLookup>(); // dedupe created empresas by normalized name

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
    let empresaId = row.empresa_id || null;
    const empresaNome = (row as any).empresa_nome?.trim() || "";
    const cpf = normalizeCpf(row.cpf_colaborador);
    const matricula = normalizeMatricula(row.matricula_colaborador);
    const nomeNormalizado = normalizeText(nome);

    // -----------------------------------------------------------
    // Resolve empresa_id from empresa_nome when missing
    // -----------------------------------------------------------
    if (!empresaId && empresaNome) {
      const empresaNomeKey = normalizeCompanyText(empresaNome);

      // 1. Try matching existing empresa by name
      const found = findEmpresaByName(empresaNome, empresaLookup);
      if (found) {
        empresaId = found.id;
      } else if (empresaNomeKey) {
        // 2. Check if we already created it in this batch
        const cached = empresaCreateCache.get(empresaNomeKey);
        if (cached) {
          empresaId = cached.id;
        } else {
          // 3. Create minimal empresa
          const newEmpresa = await createMinimalEmpresa(tenantId, empresaNome);
          empresaId = newEmpresa.id;
          empresaLookup.set(empresaNomeKey, newEmpresa);
          empresaCreateCache.set(empresaNomeKey, newEmpresa);
        }
      }

      // Update the row so the ponto record also gets the resolved empresa_id
      (row as any).empresa_id = empresaId;
    }

    const dedupeKey = cpf 
      ? `cpf:${cpf}` 
      : matricula && empresaId 
        ? `matricula:${matricula}:${empresaId}` 
        : matricula 
          ? `matricula:${matricula}`
          : nomeNormalizado && empresaId 
            ? `nome:${nomeNormalizado}:${empresaId}` 
            : nomeNormalizado
              ? `nome:${nomeNormalizado}`
              : "";

    if (!nome || !dedupeKey) {
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
          empresaId: empresaId || "",
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
          if (resolved.empresa_id) {
            maps.byMatricula.set(`${matricula}::${resolved.empresa_id}`, resolved);
          }
          maps.byMatricula.set(matricula, resolved);
        }

        if (nomeNormalizado) {
          if (resolved.empresa_id) {
            maps.byNomeEmpresa.set(`${nomeNormalizado}::${resolved.empresa_id}`, resolved);
          }
          maps.byNome.set(nomeNormalizado, resolved);
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
