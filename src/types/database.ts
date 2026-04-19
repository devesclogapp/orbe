export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string
          nome: string
          cnpj: string
          unidade: string | null
          cidade: string | null
          estado: string | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          cnpj: string
          unidade?: string | null
          cidade?: string | null
          estado?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cnpj?: string
          unidade?: string | null
          cidade?: string | null
          estado?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contratos: {
        Row: {
          id: string
          tipo: string
          valor_base: number
          regras: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tipo: string
          valor_base?: number
          regras?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tipo?: string
          valor_base?: number
          regras?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      colaboradores: {
        Row: {
          id: string
          nome: string
          cargo: string | null
          empresa_id: string | null
          tipo_contrato: string
          valor_base: number | null
          flag_faturamento: boolean | null
          status: string | null
          data_admissao: string | null
          matricula: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          cargo?: string | null
          empresa_id?: string | null
          tipo_contrato: string
          valor_base?: number | null
          flag_faturamento?: boolean | null
          status?: string | null
          data_admissao?: string | null
          matricula?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cargo?: string | null
          empresa_id?: string | null
          tipo_contrato?: string
          valor_base?: number | null
          flag_faturamento?: boolean | null
          status?: string | null
          data_admissao?: string | null
          matricula?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      operacoes: {
        Row: {
          id: string
          data: string
          transportadora: string
          tipo_servico: string
          quantidade: number
          horario_inicio: string | null
          horario_fim: string | null
          produto: string | null
          valor_unitario: number | null
          status: string | null
          responsavel_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          data?: string
          transportadora: string
          tipo_servico: string
          quantidade: number
          horario_inicio?: string | null
          horario_fim?: string | null
          produto?: string | null
          valor_unitario?: number | null
          status?: string | null
          responsavel_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          data?: string
          transportadora?: string
          tipo_servico?: string
          quantidade?: number
          horario_inicio?: string | null
          horario_fim?: string | null
          produto?: string | null
          valor_unitario?: number | null
          status?: string | null
          responsavel_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      registros_ponto: {
        Row: {
          id: string
          colaborador_id: string | null
          data: string
          entrada: string | null
          saida_almoco: string | null
          retorno_almoco: string | null
          saida: string | null
          periodo: string | null
          tipo_dia: string | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          colaborador_id?: string | null
          data?: string
          entrada?: string | null
          saida_almoco?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          periodo?: string | null
          tipo_dia?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          colaborador_id?: string | null
          data?: string
          entrada?: string | null
          saida_almoco?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          periodo?: string | null
          tipo_dia?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      coletores: {
        Row: {
          id: string
          modelo: string
          serie: string
          empresa_id: string | null
          status: string | null
          ultima_sync: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          modelo: string
          serie: string
          empresa_id?: string | null
          status?: string | null
          ultima_sync?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          modelo?: string
          serie?: string
          empresa_id?: string | null
          status?: string | null
          ultima_sync?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      logs_sincronizacao: {
        Row: {
          id: string
          data: string
          origem: string
          empresa_id: string | null
          contagem_registros: number | null
          status: string | null
          duracao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          data?: string
          origem: string
          empresa_id?: string | null
          contagem_registros?: number | null
          status?: string | null
          duracao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          data?: string
          origem?: string
          empresa_id?: string | null
          contagem_registros?: number | null
          status?: string | null
          duracao?: string | null
          created_at?: string
        }
      }
      resultados_processamento: {
        Row: {
          id: string
          data: string
          empresa_id: string | null
          valor_total_calculado: number | null
          total_operacoes: number | null
          contagem_inconsistencias: number | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          data: string
          empresa_id?: string | null
          valor_total_calculado?: number | null
          total_operacoes?: number | null
          contagem_inconsistencias?: number | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          data?: string
          empresa_id?: string | null
          valor_total_calculado?: number | null
          total_operacoes?: number | null
          contagem_inconsistencias?: number | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
