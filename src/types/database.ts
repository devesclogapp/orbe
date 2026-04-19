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
      auditoria: {
        Row: {
          acao: string
          created_at: string | null
          detalhes: Json | null
          id: string
          impacto: string
          modulo: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          impacto: string
          modulo: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          impacto?: string
          modulo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      banco_horas_eventos: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          data: string
          descricao: string | null
          id: string
          origem: string
          quantidade_minutos: number
          tipo: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: string
          origem: string
          quantidade_minutos: number
          tipo: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: string
          origem?: string
          quantidade_minutos?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "banco_horas_eventos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          }
        ]
      }
      banco_horas_regras: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          nome: string
          prazo_compensacao_dias: number
          status: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          prazo_compensacao_dias: number
          status?: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          prazo_compensacao_dias?: number
          status?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banco_horas_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          }
        ]
      }
      clientes: {
        Row: {
          created_at: string | null
          email_contato: string | null
          id: string
          nome: string
          razao_social: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_contato?: string | null
          id?: string
          nome: string
          razao_social?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_contato?: string | null
          id?: string
          nome?: string
          razao_social?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          cargo: string
          created_at: string | null
          empresa_id: string | null
          flag_faturamento: boolean | null
          id: string
          matricula: string
          nome: string
          status: string | null
          tipo_contrato: string | null
          updated_at: string | null
          valor_base: number | null
        }
        Insert: {
          cargo: string
          created_at?: string | null
          empresa_id?: string | null
          flag_faturamento?: boolean | null
          id?: string
          matricula: string
          nome: string
          status?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
          valor_base?: number | null
        }
        Update: {
          cargo?: string
          created_at?: string | null
          empresa_id?: string | null
          flag_faturamento?: boolean | null
          id?: string
          matricula?: string
          nome?: string
          status?: string | null
          tipo_contrato?: string | null
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
          }
        ]
      }
      coletores: {
        Row: {
          created_at: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          modelo: string | null
          nome: string
          serial: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          modelo?: string | null
          nome: string
          serial?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          modelo?: string | null
          nome?: string
          serial?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coletores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          }
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string
          banco: string
          conta: string
          created_at: string | null
          empresa_id: string | null
          id: string
          nome: string
          pix_chave: string | null
        }
        Insert: {
          agencia: string
          banco: string
          conta: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          pix_chave?: string | null
        }
        Update: {
          agencia?: string
          banco?: string
          conta?: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          pix_chave?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          }
        ]
      }
      contratos: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          periodo_fim: string | null
          periodo_inicio: string | null
          status: string | null
          tipo: string | null
          valor_mensal: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string | null
          tipo?: string | null
          valor_mensal?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string | null
          tipo?: string | null
          valor_mensal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          }
        ]
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
          cliente_id: string | null
          competencia: string
          created_at: string | null
          id: string
          lote_id: string | null
          nosso_numero: string | null
          status: string | null
          valor_total: number
          vencimento: string
        }
        Insert: {
          cliente_id?: string | null
          competencia: string
          created_at?: string | null
          id?: string
          lote_id?: string | null
          nosso_numero?: string | null
          status?: string | null
          valor_total: number
          vencimento: string
        }
        Update: {
          cliente_id?: string | null
          competencia?: string
          created_at?: string | null
          id?: string
          lote_id?: string | null
          nosso_numero?: string | null
          status?: string | null
          valor_total?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          }
        ]
      }
      financeiro_competencias: {
        Row: {
          competencia: string
          created_at: string | null
          id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          competencia: string
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          competencia?: string
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      financeiro_consolidados_cliente: {
        Row: {
          cliente_id: string | null
          competencia: string
          created_at: string | null
          id: string
          total_horas: number | null
          total_operacoes: number | null
          valor_total: number | null
        }
        Insert: {
          cliente_id?: string | null
          competencia: string
          created_at?: string | null
          id?: string
          total_horas?: number | null
          total_operacoes?: number | null
          valor_total?: number | null
        }
        Update: {
          cliente_id?: string | null
          competencia?: string
          created_at?: string | null
          id?: string
          total_horas?: number | null
          total_operacoes?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_consolidados_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          }
        ]
      }
      financeiro_consolidados_colaborador: {
        Row: {
          colaborador_id: string | null
          competencia: string
          created_at: string | null
          id: string
          total_horas: number | null
          total_operacoes: number | null
          valor_total: number | null
        }
        Insert: {
          colaborador_id?: string | null
          competencia: string
          created_at?: string | null
          id?: string
          total_horas?: number | null
          total_operacoes?: number | null
          valor_total?: number | null
        }
        Update: {
          colaborador_id?: string | null
          competencia?: string
          created_at?: string | null
          id?: string
          total_horas?: number | null
          total_operacoes?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_consolidados_colaborador_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          }
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
          updated_at: string | null
          valor: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          status?: string | null
          tipo: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          status?: string | null
          tipo?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_regras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          }
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
          }
        ]
      }
      lotes_remessa: {
        Row: {
          arquivo_path: string | null
          competencia: string
          contagem_faturas: number | null
          created_at: string | null
          data_geracao: string | null
          id: string
          sequencial: number
          status: string | null
          valor_total: number
        }
        Insert: {
          arquivo_path?: string | null
          competencia: string
          contagem_faturas?: number | null
          created_at?: string | null
          data_geracao?: string | null
          id?: string
          sequencial: number
          status?: string | null
          valor_total: number
        }
        Update: {
          arquivo_path?: string | null
          competencia?: string
          contagem_faturas?: number | null
          created_at?: string | null
          data_geracao?: string | null
          id?: string
          sequencial?: number
          status?: string | null
          valor_total?: number
        }
        Relationships: []
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
          colaborador_id: string | null
          created_at: string | null
          data: string
          id: string
          status: string | null
          updated_at: string | null
          valor_operacao: number | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          data: string
          id?: string
          status?: string | null
          updated_at?: string | null
          valor_operacao?: number | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          data?: string
          id?: string
          status?: string | null
          updated_at?: string | null
          valor_operacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          }
        ]
      }
      perfis: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          permissoes: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          permissoes?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          permissoes?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      perfis_usuarios: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          perfil_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          perfil_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          perfil_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_usuarios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          }
        ]
      }
      records_ponto: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          data: string
          entrada_1: string | null
          entrada_2: string | null
          id: string
          saida_1: string | null
          saida_2: string | null
          total_minutos: number | null
          updated_at: string | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          data: string
          entrada_1?: string | null
          entrada_2?: string | null
          id?: string
          saida_1?: string | null
          saida_2?: string | null
          total_minutos?: number | null
          updated_at?: string | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          data?: string
          entrada_1?: string | null
          entrada_2?: string | null
          id?: string
          saida_1?: string | null
          saida_2?: string | null
          total_minutos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          }
        ]
      }
      resultados_processamento: {
        Row: {
          created_at: string | null
          data: string
          empresa_id: string | null
          id: string
          total_horas_extras: number | null
          total_horas_normais: number | null
          total_inconsistencias: number | null
          total_operacoes: number | null
          valor_total_calculado: number | null
        }
        Insert: {
          created_at?: string | null
          data: string
          empresa_id?: string | null
          id?: string
          total_horas_extras?: number | null
          total_horas_normais?: number | null
          total_inconsistencias?: number | null
          total_operacoes?: number | null
          valor_total_calculado?: number | null
        }
        Update: {
          created_at?: string | null
          data?: string
          empresa_id?: string | null
          id?: string
          total_horas_extras?: number | null
          total_horas_normais?: number | null
          total_inconsistencias?: number | null
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
          }
        ]
      }
      relatorios_catalogo: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          categoria: string
          formatos_disponiveis: string[] | null
          filtros_suportados: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          categoria: string
          formatos_disponiveis?: string[] | null
          filtros_suportados?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          descricao?: string | null
          categoria?: string
          formatos_disponiveis?: string[] | null
          filtros_suportados?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      relatorios_favoritos: {
        Row: {
          id: string
          user_id: string
          relatorio_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          relatorio_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          relatorio_id?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_favoritos_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_catalogo"
            referencedColumns: ["id"]
          }
        ]
      }
      relatorios_layouts_exportacao: {
        Row: {
          id: string
          nome: string
          tipo: string
          destino: string
          colunas: Json
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          tipo: string
          destino: string
          colunas: Json
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          tipo?: string
          destino?: string
          colunas?: Json
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      relatorios_agendamentos: {
        Row: {
          id: string
          nome: string
          relatorio_id: string | null
          frequencia: string
          destinatarios: string[]
          filtros_padrao: Json | null
          layout_id: string | null
          status: string | null
          ultima_execucao: string | null
          proxima_execucao: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          relatorio_id?: string | null
          frequencia: string
          destinatarios: string[]
          filtros_padrao?: Json | null
          layout_id?: string | null
          status?: string | null
          ultima_execucao?: string | null
          proxima_execucao?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          relatorio_id?: string | null
          frequencia?: string
          destinatarios?: string[]
          filtros_padrao?: Json | null
          layout_id?: string | null
          status?: string | null
          ultima_execucao?: string | null
          proxima_execucao?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_agendamentos_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_agendamentos_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "relatorios_layouts_exportacao"
            referencedColumns: ["id"]
          }
        ]
      }
      contabil_configuracao: {
        Row: {
          id: string
          sistema_destino: string
          status: string | null
          credenciais: Json | null
          parametros_api: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          sistema_destino: string
          status?: string | null
          credenciais?: Json | null
          parametros_api?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          sistema_destino?: string
          status?: string | null
          credenciais?: Json | null
          parametros_api?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contabil_mapeamento: {
        Row: {
          id: string
          operacao_tipo: string
          conta_contabil: string
          classificacao: string | null
          empresa_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          operacao_tipo: string
          conta_contabil: string
          classificacao?: string | null
          empresa_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          operacao_tipo?: string
          conta_contabil?: string
          classificacao?: string | null
          empresa_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contabil_mapeamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          }
        ]
      }
      contabil_logs_integracao: {
        Row: {
          id: string
          execucao_data: string | null
          tipo_envio: string
          status: string
          sistema_destino: string
          payload: Json | null
          resposta_sistema: Json | null
          erro_detalhe: string | null
          user_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          execucao_data?: string | null
          tipo_envio: string
          status: string
          sistema_destino: string
          payload?: Json | null
          resposta_sistema?: Json | null
          erro_detalhe?: string | null
          user_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          execucao_data?: string | null
          tipo_envio?: string
          status?: string
          sistema_destino?: string
          payload?: Json | null
          resposta_sistema?: Json | null
          erro_detalhe?: string | null
          user_id?: string | null
          created_at?: string | null
        }
        Relationships: []
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
