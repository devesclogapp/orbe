import { supabase } from "@/lib/supabase";

export const getTenantQueryFilter = async (table: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.tenant_id) return {};

  // Se a tabela tem empresa_id, filtra por empresa que pertence ao tenant
  const tablesWithEmpresaId = [
    "operacoes", "operacoes_producao", "custos_extras_operacionais",
    "colaboradores", "diaristas", "registros_ponto", "unidades",
    "transportadoras_clientes", "fornecedores", "produtos_carga"
  ];

  if (tablesWithEmpresaId.includes(table)) {
    const { data: empresas } = await supabase
      .from("empresas")
      .select("id")
      .eq("tenant_id", profile.tenant_id);
    
    if (empresas && empresas.length > 0) {
      return { empresa_id: { in: empresas.map(e => e.id) } };
    }
    return { empresa_id: "none" };
  }

  // Se a tabela tem tenant_id diretamente
  return { tenant_id: profile.tenant_id };
};

export const withTenantFilter = <T extends any[]>(table: string, queryBuilder: any): any => {
  // Esta função será usada para adicionar filtro de tenant às queries
  //返回一个带有 tenant 过滤的查询构建器
  return queryBuilder;
};