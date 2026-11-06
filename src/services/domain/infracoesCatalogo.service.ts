import { supabase } from '@/lib/supabase';

export type CategoriaInfracao = 'OPERACIONAL' | 'DISCIPLINAR' | 'SEGURANCA' | 'QUALIDADE';

export interface InfracaoCatalogo {
  id: string;
  tenant_id?: string;
  codigo: string;
  nome: string;
  categoria: CategoriaInfracao;
  descricao?: string | null;
  valor_referencia: number;
  exige_dano_material: boolean;
  fundamentacao_padrao?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InfracaoInput {
  codigo: string;
  nome: string;
  categoria: CategoriaInfracao;
  descricao?: string;
  valor_referencia: number;
  exige_dano_material: boolean;
  fundamentacao_padrao?: string;
  ativo?: boolean;
}

export class InfracoesCatalogoService {
  /**
   * Lista infrações ativas cadastradas exclusivamente pelo Admin/RH.
   * Não utiliza valores fictícios. Falhas de banco são propagadas como erro explícito.
   */
  static async listarAtivos(): Promise<InfracaoCatalogo[]> {
    const { data, error } = await supabase
      .from('infracoes_operacionais_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) {
      console.error('[InfracoesCatalogoService] Erro ao consultar infrações ativas:', error);
      throw new Error(`CATALOGO_INDISPONIVEL: ${error.message || 'Falha de conexão com o banco de dados'}`);
    }

    return (data || []) as InfracaoCatalogo[];
  }

  /**
   * Lista todas as infrações (incluindo inativas) para tela de configurações do Admin.
   */
  static async listarTodos(): Promise<InfracaoCatalogo[]> {
    const { data, error } = await supabase
      .from('infracoes_operacionais_catalogo')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.error('[InfracoesCatalogoService] Erro ao consultar catálogo completo:', error);
      throw new Error(`CATALOGO_INDISPONIVEL: ${error.message || 'Falha ao acessar catálogo'}`);
    }

    return (data || []) as InfracaoCatalogo[];
  }

  /**
   * Cadastra nova infração no catálogo.
   */
  static async cadastrar(input: InfracaoInput): Promise<InfracaoCatalogo> {
    const tenantId = await this.resolveTenantId();

    const payload = {
      tenant_id: tenantId,
      codigo: input.codigo.trim().toUpperCase().replace(/\s+/g, '_'),
      nome: input.nome.trim(),
      categoria: input.categoria,
      descricao: input.descricao?.trim() || null,
      valor_referencia: Number(input.valor_referencia || 0),
      exige_dano_material: Boolean(input.exige_dano_material),
      fundamentacao_padrao: input.fundamentacao_padrao?.trim() || null,
      ativo: input.ativo !== undefined ? input.ativo : true,
    };

    const { data, error } = await supabase
      .from('infracoes_operacionais_catalogo')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as InfracaoCatalogo;
  }

  /**
   * Atualiza infração existente.
   */
  static async atualizar(id: string, patch: Partial<InfracaoInput>): Promise<InfracaoCatalogo> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (patch.nome !== undefined) updateData.nome = patch.nome.trim();
    if (patch.categoria !== undefined) updateData.categoria = patch.categoria;
    if (patch.descricao !== undefined) updateData.descricao = patch.descricao.trim();
    if (patch.valor_referencia !== undefined) updateData.valor_referencia = Number(patch.valor_referencia || 0);
    if (patch.exige_dano_material !== undefined) updateData.exige_dano_material = patch.exige_dano_material;
    if (patch.fundamentacao_padrao !== undefined) updateData.fundamentacao_padrao = patch.fundamentacao_padrao.trim();
    if (patch.ativo !== undefined) updateData.ativo = patch.ativo;

    const { data, error } = await supabase
      .from('infracoes_operacionais_catalogo')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as InfracaoCatalogo;
  }

  /**
   * Desativação lógica (soft delete). Nunca exclui fisicamente para preservar integridade histórica.
   */
  static async desativar(id: string): Promise<void> {
    const { error } = await supabase
      .from('infracoes_operacionais_catalogo')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  private static async resolveTenantId(): Promise<string> {
    try {
      const { data } = await supabase.rpc('current_tenant_id');
      if (data) return data;
    } catch {
      // Ignora erro se RPC não existir
    }
    return '00000000-0000-0000-0000-000000000000';
  }
}
