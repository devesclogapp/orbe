import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const normalizeCompanyText = (value: string) => {
  const normalized = normalizeText(value);
  return normalized
    .replace(/\b(ltda|me|eireli)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export class EmpresaResolver {
  private uniqueEmpresasMap: Map<string, { id: string }>;
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient;
  private readonly origem: string;
  public empresasCriadas: number = 0;

  constructor(supabase: SupabaseClient, tenantId: string, origem: string = 'api') {
    this.supabase = supabase;
    this.tenantId = tenantId;
    this.uniqueEmpresasMap = new Map();
    this.origem = origem;
    this.empresasCriadas = 0;
  }

  /**
   * Pre-loads the company map to avoid repeated database calls.
   */
  async loadCache(): Promise<void> {
    const { data: dbEmpresas } = await this.supabase
      .from('empresas')
      .select('id, nome')
      .eq('tenant_id', this.tenantId);

    if (dbEmpresas) {
      dbEmpresas.forEach(e => {
        if (e.nome) {
          this.uniqueEmpresasMap.set(normalizeCompanyText(e.nome), { id: e.id });
        }
      });
    }
  }

  /**
   * Tries to find the company UUID based on name.
   */
  resolveParams(rawCmpName: string | null): string | null {
    if (!rawCmpName) return null;
    const normCmpName = normalizeCompanyText(rawCmpName);
    if (this.uniqueEmpresasMap.has(normCmpName)) {
      return this.uniqueEmpresasMap.get(normCmpName)!.id;
    }
    return null;
  }

  /**
   * Creates a provisory company (homologated behavior of RHID).
   */
  async criarEmpresaProvisoria(rawCmpName: string): Promise<string | null> {
    // ---------------------------------------------------------------------------------
    // PROPOSTA DE CORREÇÃO ESTRUTURAL (ETAPA 04 - Hardening)
    // Validação agressiva para evitar criação de empresas com lixo de concatenação
    // ---------------------------------------------------------------------------------
    
    // Regras de Rejeição Curativa:
    // 1. Se contém vírgula, ponto e vírgula, ou parênteses, provavelmente é array, json ou múltiplos departamentos errados do Tio Digital
    // 2. Se o tamanho da string for excessivo (ex: > 60 caracteres)
    
    if (/[,;()]/.test(rawCmpName) || rawCmpName.length > 60) {
       console.warn(`[EMPRESA_RESOLVER] Rejeitado vazamento de strings malformadas como empresa provisória: "${rawCmpName}"`);
       // Em vez de criar empresa fantasma com vírgula, retornamos null para cair no tratamento de divergência sem poluir a tabela de empresas.
       return null;
    }

    const ts = Date.now().toString().slice(-6);
    const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    const normCmpName = normalizeCompanyText(rawCmpName);
    
    const { data: newEmp } = await this.supabase.from('empresas')
      .insert({
        tenant_id: this.tenantId,
        nome: rawCmpName,
        origem: this.origem,
        cnpj: `00000${ts}${rand}`,
        status: 'ativa',
        cadastro_provisorio: true,
        unidade: 'Não informado',
        cidade: 'Não informado',
      })
      .select('id').single();
      
    if (newEmp) {
      this.uniqueEmpresasMap.set(normCmpName, { id: newEmp.id });
      this.empresasCriadas++;
      return newEmp.id;
    }
    
    return null;
  }

  /**
   * Facade method to find or create safely (encapsulated logic).
   */
  async resolveOrCreate(rawCmpName: string | null): Promise<string | null> {
    const fallbackName = rawCmpName || "Empresa Desconhecida API";
    const resolvedId = this.resolveParams(fallbackName);
    if (resolvedId) {
       return resolvedId;
    }
    
    // Only create if we actually have some valid naming criteria to avoid useless blank rows,
    // although RHID allows "Empresa Desconhecida API". We preserve RHID strictly:
    const normCmpName = normalizeCompanyText(fallbackName);
    if (normCmpName && fallbackName !== "Empresa Desconhecida API") {
       return await this.criarEmpresaProvisoria(fallbackName);
    }
    
    return null;
  }

  // Permite verificar se houve criações pra fins de logs
  getMapSize(): number {
    return this.uniqueEmpresasMap.size;
  }
}
