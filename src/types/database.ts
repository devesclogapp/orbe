export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          status?: string | null
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          cargo: string | null
          created_at: string | null
          data_admissao: string | null
          empresa_id: string | null
          flag_faturamento: boolean | null
          id: string
          matricula: string | null
          nome: string
          status: string | null
          tipo_contrato: string
          updated_at: string | null
          valor_base: number | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string | null
          data_admissao?: string | null
          empresa_id?: string | null
          flag_faturamento?: boolean | null
          id?: string
          matricula?: string | null
          nome: string
          status?: string | null
          tipo_contrato: string
          updated_at?: string | null
          valor_base?: number | null
        }
        Update: {
          cargo?: string | null
          created_at?: string | null
          data_admissao?: string | null
          empresa_id?: string | null
          flag_faturamento?: boolean | null
          id?: string
          matricula?: string | null
          nome?: string
          status?: string | null
          tipo_contrato?: string
          updated_at?: string | null
          valor_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      coletores: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          modelo: string
          serie: string
          status: string | null
          ultima_sync: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          modelo: string
          serie: string
          status?: string | null
          ultima_sync?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          modelo?: string
          serie?: string
          status?: string | null
          ultima_sync?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coletores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string
          banco: string
          carteira: string | null
          conta: string
          convenio: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          padrao: boolean | null
          updated_at: string | null
        }
        Insert: {
          agencia: string
          banco: string
          carteira?: string | null
          conta: string
          convenio?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          padrao?: boolean | null
          updated_at?: string | null
        }
        Update: {
          agencia?: string
          banco?: string
          carteira?: string | null
          conta?: string
          convenio?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          padrao?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          created_at: string | null
          id: string
          regras: Json | null
          tipo: string
          updated_at: string | null
          valor_base: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          regras?: Json | null
          tipo: string
          updated_at?: string | null
          valor_base?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          regras?: Json | null
          tipo?: string
          updated_at?: string | null
          valor_base?: number
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cidade: string | null
          cnpj: string
          created_at: string | null
          estado: string | null
          id: string
          nome: string
          status: string | null
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          cidade?: string | null
          cnpj: string
          created_at?: string | null
          estado?: string | null
          id?: string
          nome: string
          status?: string | null
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          cidade?: string | null
          cnpj?: string
          created_at?: string | null
          estado?: string | null
          id?: string
          nome?: string
          status?: string | null
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      faturas: {
        Row: {
          colaborador_id: string | null
          competencia: string
          created_at: string | null
          data_pagamento: string | null
          empresa_id: string | null
          id: string
          lote_remessa_id: string | null
          motivo_rejeicao: string | null
          nosso_numero: string | null
          status: string | null
          updated_at: string | null
          valor: number
          vencimento: string
        }
        Insert: {
          colaborador_id?: string | null
          competencia: string
          created_at?: string | null
          data_pagamento?: string | null
          empresa_id?: string | null
          id?: string
          lote_remessa_id?: string | null
          motivo_rejeicao?: string | null
          nosso_numero?: string | null
          status?: string | null
          updated_at?: string | null
          valor: number
          vencimento: string
        }
        Update: {
          colaborador_id?: string | null
          competencia?: string
          created_at?: string | null
          data_pagamento?: string | null
          empresa_id?: string | null
          id?: string
          lote_remessa_id?: string | null
          motivo_rejeicao?: string | null
          nosso_numero?: string | null
          status?: string | null
          updated_at?: string | null
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_lote_remessa_id_fkey"
            columns: ["lote_remessa_id"]
            isOneToOne: false
            referencedRelation: "lotes_remessa"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_competencias: {
        Row: {
          competencia: string
          contagem_inconsistencias: number | null
          created_at: string | null
          fechado_em: string | null
          status: string | null
          valor_total_faturado: number | null
        }
        Insert: {
          competencia: string
          contagem_inconsistencias?: number | null
          created_at?: string | null
          fechado_em?: string | null
          status?: string | null
          valor_total_faturado?: number | null
        }
        Update: {
          competencia?: string
          contagem_inconsistencias?: number | null
          created_at?: string | null
          fechado_em?: string | null
          status?: string | null
          valor_total_faturado?: number | null
        }
        Relationships: []
      }
      financeiro_consolidados_cliente: {
        Row: {
          cliente_id: string | null
          competencia: string | null
          created_at: string | null
          id: string
          memoria_calculo: Json | null
          quantidade_operacoes: number | null
          status: string | null
          valor_base: number | null
          valor_regras: number | null
          valor_total: number | null
        }
        Insert: {
          cliente_id?: string | null
          competencia?: string | null
          created_at?: string | null
          id?: string
          memoria_calculo?: Json | null
          quantidade_operacoes?: number | null
          status?: string | null
          valor_base?: number | null
          valor_regras?: number | null
          valor_total?: number | null
        }
        Update: {
          cliente_id?: string | null
          competencia?: string | null
          created_at?: string | null
          id?: string
          memoria_calculo?: Json | null
          quantidade_operacoes?: number | null
          status?: string | null
          valor_base?: number | null
          valor_regras?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_consolidados_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_consolidados_cliente_competencia_fkey"
            columns: ["competencia"]
            isOneToOne: false
            referencedRelation: "financeiro_competencias"
            referencedColumns: ["competencia"]
          },
        ]
      }
      financeiro_consolidados_colaborador: {
        Row: {
          colaborador_id: string | null
          competencia: string | null
          created_at: string | null
          eventos_financeiros: Json | null
          id: string
          status: string | null
          valor_total: number | null
        }
        Insert: {
          colaborador_id?: string | null
          competencia?: string | null
          created_at?: string | null
          eventos_financeiros?: Json | null
          id?: string
          status?: string | null
          valor_total?: number | null
        }
        Update: {
          colaborador_id?: string | null
          competencia?: string | null
          created_at?: string | null
          eventos_financeiros?: Json | null
          id?: string
          status?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_consolidados_colaborador_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_consolidados_colaborador_competencia_fkey"
            columns: ["competencia"]
            isOneToOne: false
            referencedRelation: "financeiro_competencias"
            referencedColumns: ["competencia"]
          },
        ]
      }
      financeiro_regras: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          id: string
          nome: string
          status: string | null
          tipo: string
          unidade: string
          valor: number
          vigencia_fim: string | null
          vigencia_inicio: string | null
          vinculo: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          status?: string | null
          tipo: string
          unidade: string
          valor: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
          vinculo: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          status?: string | null
          tipo?: string
          unidade?: string
          valor?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
          vinculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_regras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_sincronizacao: {
        Row: {
          contagem_registros: number | null
          created_at: string | null
          data: string | null
          duracao: string | null
          empresa_id: string | null
          id: string
          origem: string
          status: string | null
        }
        Insert: {
          contagem_registros?: number | null
          created_at?: string | null
          data?: string | null
          duracao?: string | null
          empresa_id?: string | null
          id?: string
          origem: string
          status?: string | null
        }
        Update: {
          contagem_registros?: number | null
          created_at?: string | null
          data?: string | null
          duracao?: string | null
          empresa_id?: string | null
          id?: string
          origem?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_sincronizacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_remessa: {
        Row: {
          arquivo_path: string | null
          competencia: string
          conta_bancaria_id: string | null
          created_at: string | null
          id: string
          quantidade_titulos: number | null
          status: string | null
          valor_total: number | null
        }
        Insert: {
          arquivo_path?: string | null
          competencia: string
          conta_bancaria_id?: string | null
          created_at?: string | null
          id?: string
          quantidade_titulos?: number | null
          status?: string | null
          valor_total?: number | null
        }
        Update: {
          arquivo_path?: string | null
          competencia?: string
          conta_bancaria_id?: string | null
          created_at?: string | null
          id?: string
          quantidade_titulos?: number | null
          status?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_remessa_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_retorno: {
        Row: {
          arquivo_path: string | null
          banco: string
          created_at: string | null
          data_importacao: string | null
          id: string
          resumo: Json | null
          status: string | null
        }
        Insert: {
          arquivo_path?: string | null
          banco: string
          created_at?: string | null
          data_importacao?: string | null
          id?: string
          resumo?: Json | null
          status?: string | null
        }
        Update: {
          arquivo_path?: string | null
          banco?: string
          created_at?: string | null
          data_importacao?: string | null
          id?: string
          resumo?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      operacoes: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          data: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          produto: string | null
          quantidade: number
          responsavel_id: string | null
          status: string | null
          tipo_servico: string
          transportadora: string
          updated_at: string | null
          valor_unitario: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          data?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          produto?: string | null
          quantidade: number
          responsavel_id?: string | null
          status?: string | null
          tipo_servico: string
          transportadora: string
          updated_at?: string | null
          valor_unitario?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          data?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          produto?: string | null
          quantidade?: number
          responsavel_id?: string | null
          status?: string | null
          tipo_servico?: string
          transportadora?: string
          updated_at?: string | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_ponto: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          data: string
          entrada: string | null
          id: string
          periodo: string | null
          retorno_almoco: string | null
          saida: string | null
          saida_almoco: string | null
          status: string | null
          tipo_dia: string | null
          updated_at: string | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          data: string
          entrada?: string | null
          id?: string
          periodo?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          saida_almoco?: string | null
          status?: string | null
          tipo_dia?: string | null
          updated_at?: string | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          data?: string
          entrada?: string | null
          id?: string
          periodo?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          saida_almoco?: string | null
          status?: string | null
          tipo_dia?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados_processamento: {
        Row: {
          contagem_inconsistencias: number | null
          created_at: string | null
          data: string
          empresa_id: string | null
          id: string
          status: string | null
          total_operacoes: number | null
          valor_total_calculado: number | null
        }
        Insert: {
          contagem_inconsistencias?: number | null
          created_at?: string | null
          data: string
          empresa_id?: string | null
          id?: string
          status?: string | null
          total_operacoes?: number | null
          valor_total_calculado?: number | null
        }
        Update: {
          contagem_inconsistencias?: number | null
          created_at?: string | null
          data?: string
          empresa_id?: string | null
          id?: string
          status?: string | null
          total_operacoes?: number | null
          valor_total_calculado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resultados_processamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>
export type DefaultSchema = DatabaseWithoutInternals['public']

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (DatabaseWithoutInternals['public']['Tables'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (DatabaseWithoutInternals['public']['Tables'])
    ? DatabaseWithoutInternals['public']['Tables'][PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof (DatabaseWithoutInternals['public']['Tables'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof (DatabaseWithoutInternals['public']['Tables'])
    ? DatabaseWithoutInternals['public']['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof (DatabaseWithoutInternals['public']['Tables'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof (DatabaseWithoutInternals['public']['Tables'])
    ? DatabaseWithoutInternals['public']['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof (DatabaseWithoutInternals['public']['Enums'])
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof (DatabaseWithoutInternals['public']['Enums'])
    ? DatabaseWithoutInternals['public']['Enums'][PublicEnumNameOrOptions]
    : never
