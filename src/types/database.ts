export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      coletores: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          modelo: string
          serie: string
          status: string | null
          ultima_sync: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          modelo: string
          serie: string
          status?: string | null
          ultima_sync?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          modelo?: string
          serie?: string
          status?: string | null
          ultima_sync?: string | null
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
      contratos: {
        Row: {
          created_at: string | null
          id: string
          regras: Json | null
          tipo: string
          valor_base: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          regras?: Json | null
          tipo: string
          valor_base: number
        }
        Update: {
          created_at?: string | null
          id?: string
          regras?: Json | null
          tipo?: string
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
        }
        Relationships: []
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
