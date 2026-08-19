// Tipos GERADOS a partir do banco — não edite à mão.
// Fonte: `npx supabase gen types typescript --local` com as migrations 0001 a
// 0008 aplicadas (`npm run db:reset`). Regerar sempre que uma migration entrar.
//
// ⚠️ O bloco da migration 0008 (CONTAI-010) foi escrito À MÃO, no formato que o
// gerador produz, porque o projeto não estava linkado na sessão em que a
// migration nasceu. Regerar com o CLI na próxima oportunidade — se o resultado
// divergir daqui, quem vale é o CLI.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      compromisso: {
        Row: {
          created_at: string
          data_compra: string | null
          data_prevista: string | null
          documento_origem_id: string | null
          favorecido_id: string | null
          id: string
          motivo_cancelamento: string | null
          obra_id: string
          origem: Database["public"]["Enums"]["origem_compromisso"]
          situacao: Database["public"]["Enums"]["situacao_compromisso"]
          user_id: string
          valor_previsto: number
        }
        Insert: {
          created_at?: string
          data_compra?: string | null
          data_prevista?: string | null
          documento_origem_id?: string | null
          favorecido_id?: string | null
          id?: string
          motivo_cancelamento?: string | null
          obra_id: string
          origem: Database["public"]["Enums"]["origem_compromisso"]
          situacao?: Database["public"]["Enums"]["situacao_compromisso"]
          user_id?: string
          valor_previsto: number
        }
        Update: {
          created_at?: string
          data_compra?: string | null
          data_prevista?: string | null
          documento_origem_id?: string | null
          favorecido_id?: string | null
          id?: string
          motivo_cancelamento?: string | null
          obra_id?: string
          origem?: Database["public"]["Enums"]["origem_compromisso"]
          situacao?: Database["public"]["Enums"]["situacao_compromisso"]
          user_id?: string
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "compromisso_documento_origem_id_fkey"
            columns: ["documento_origem_id"]
            isOneToOne: false
            referencedRelation: "documento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromisso_favorecido_id_fkey"
            columns: ["favorecido_id"]
            isOneToOne: false
            referencedRelation: "favorecido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromisso_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra"
            referencedColumns: ["id"]
          },
        ]
      }
      compromisso_data_historico: {
        Row: {
          compromisso_id: string
          data_anterior: string | null
          data_nova: string | null
          id: string
          registrado_em: string
        }
        Insert: {
          compromisso_id: string
          data_anterior?: string | null
          data_nova?: string | null
          id?: string
          registrado_em?: string
        }
        Update: {
          compromisso_id?: string
          data_anterior?: string | null
          data_nova?: string | null
          id?: string
          registrado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "compromisso_data_historico_compromisso_id_fkey"
            columns: ["compromisso_id"]
            isOneToOne: false
            referencedRelation: "compromisso"
            referencedColumns: ["id"]
          },
        ]
      }
      compromisso_pagamento: {
        Row: {
          compromisso_id: string
          pagamento_id: string
        }
        Insert: {
          compromisso_id: string
          pagamento_id: string
        }
        Update: {
          compromisso_id?: string
          pagamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compromisso_pagamento_compromisso_id_fkey"
            columns: ["compromisso_id"]
            isOneToOne: false
            referencedRelation: "compromisso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromisso_pagamento_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      documento: {
        Row: {
          arquivo_path: string
          classificacao: Database["public"]["Enums"]["classificacao"] | null
          created_at: string
          destinatario_cpf_ok: boolean
          favorecido_id: string | null
          id: string
          motivo_quarentena: string | null
          obra_id: string
          retencao_11: boolean | null
          status: Database["public"]["Enums"]["status_documento"]
          tipo: Database["public"]["Enums"]["tipo_documento"]
          user_id: string
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          arquivo_path: string
          classificacao?: Database["public"]["Enums"]["classificacao"] | null
          created_at?: string
          destinatario_cpf_ok: boolean
          favorecido_id?: string | null
          id?: string
          motivo_quarentena?: string | null
          obra_id: string
          retencao_11?: boolean | null
          status?: Database["public"]["Enums"]["status_documento"]
          tipo: Database["public"]["Enums"]["tipo_documento"]
          user_id?: string
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          arquivo_path?: string
          classificacao?: Database["public"]["Enums"]["classificacao"] | null
          created_at?: string
          destinatario_cpf_ok?: boolean
          favorecido_id?: string | null
          id?: string
          motivo_quarentena?: string | null
          obra_id?: string
          retencao_11?: boolean | null
          status?: Database["public"]["Enums"]["status_documento"]
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          user_id?: string
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_favorecido_id_fkey"
            columns: ["favorecido_id"]
            isOneToOne: false
            referencedRelation: "favorecido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra"
            referencedColumns: ["id"]
          },
        ]
      }
      favorecido: {
        Row: {
          created_at: string
          documento: string
          id: string
          nome: string
          retencao_11: boolean | null
          tipo: Database["public"]["Enums"]["tipo_favorecido"]
          user_id: string
        }
        Insert: {
          created_at?: string
          documento: string
          id?: string
          nome: string
          retencao_11?: boolean | null
          tipo: Database["public"]["Enums"]["tipo_favorecido"]
          user_id?: string
        }
        Update: {
          created_at?: string
          documento?: string
          id?: string
          nome?: string
          retencao_11?: boolean | null
          tipo?: Database["public"]["Enums"]["tipo_favorecido"]
          user_id?: string
        }
        Relationships: []
      }
      financiamento: {
        Row: {
          created_at: string
          data_contrato: string
          id: string
          instituicao: string
          numero_contrato: string | null
          numero_parcelas: number | null
          obra_id: string
          preco_contratado: number
          user_id: string
        }
        Insert: {
          created_at?: string
          data_contrato: string
          id?: string
          instituicao: string
          numero_contrato?: string | null
          numero_parcelas?: number | null
          obra_id: string
          preco_contratado: number
          user_id?: string
        }
        Update: {
          created_at?: string
          data_contrato?: string
          id?: string
          instituicao?: string
          numero_contrato?: string | null
          numero_parcelas?: number | null
          obra_id?: string
          preco_contratado?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financiamento_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: true
            referencedRelation: "obra"
            referencedColumns: ["id"]
          },
        ]
      }
      financiamento_informe: {
        Row: {
          amortizacao: number
          ano_base: number
          arquivo_path: string
          created_at: string
          diferenca_teorico_pago: number
          financiamento_id: string
          id: string
          juros_correcao: number
          mora: number
          multa: number
          saldo_devedor: number
          seguros: number
          taxas_fcvs: number
          total_pago: number
        }
        Insert: {
          amortizacao?: number
          ano_base: number
          arquivo_path: string
          created_at?: string
          diferenca_teorico_pago?: number
          financiamento_id: string
          id?: string
          juros_correcao?: number
          mora?: number
          multa?: number
          saldo_devedor?: number
          seguros?: number
          taxas_fcvs?: number
          total_pago: number
        }
        Update: {
          amortizacao?: number
          ano_base?: number
          arquivo_path?: string
          created_at?: string
          diferenca_teorico_pago?: number
          financiamento_id?: string
          id?: string
          juros_correcao?: number
          mora?: number
          multa?: number
          saldo_devedor?: number
          seguros?: number
          taxas_fcvs?: number
          total_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "financiamento_informe_financiamento_id_fkey"
            columns: ["financiamento_id"]
            isOneToOne: false
            referencedRelation: "financiamento"
            referencedColumns: ["id"]
          },
        ]
      }
      obra: {
        Row: {
          cartorio: string | null
          cno: string | null
          cno_registrado_em: string | null
          created_at: string
          data_inicio_obra: string
          id: string
          matricula: string | null
          municipio: string | null
          natureza_aquisicao_terreno:
            | Database["public"]["Enums"]["natureza_aquisicao_terreno"]
            | null
          nome: string
          origem_desmembramento_loteamento: boolean
          unidades_autonomas: number
          user_id: string
        }
        Insert: {
          cartorio?: string | null
          cno?: string | null
          cno_registrado_em?: string | null
          created_at?: string
          data_inicio_obra: string
          id?: string
          matricula?: string | null
          municipio?: string | null
          natureza_aquisicao_terreno?:
            | Database["public"]["Enums"]["natureza_aquisicao_terreno"]
            | null
          nome: string
          origem_desmembramento_loteamento?: boolean
          unidades_autonomas?: number
          user_id?: string
        }
        Update: {
          cartorio?: string | null
          cno?: string | null
          cno_registrado_em?: string | null
          created_at?: string
          data_inicio_obra?: string
          id?: string
          matricula?: string | null
          municipio?: string | null
          natureza_aquisicao_terreno?:
            | Database["public"]["Enums"]["natureza_aquisicao_terreno"]
            | null
          nome?: string
          origem_desmembramento_loteamento?: boolean
          unidades_autonomas?: number
          user_id?: string
        }
        Relationships: []
      }
      pagamento: {
        Row: {
          comprovante_path: string | null
          created_at: string
          data_compra: string | null
          data_pagamento: string
          favorecido_id: string | null
          id: string
          meio: Database["public"]["Enums"]["meio_pagamento"]
          obra_id: string
          status: Database["public"]["Enums"]["status_pagamento"]
          user_id: string
          valor: number
        }
        Insert: {
          comprovante_path?: string | null
          created_at?: string
          data_compra?: string | null
          data_pagamento: string
          favorecido_id?: string | null
          id?: string
          meio: Database["public"]["Enums"]["meio_pagamento"]
          obra_id: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          user_id?: string
          valor: number
        }
        Update: {
          comprovante_path?: string | null
          created_at?: string
          data_compra?: string | null
          data_pagamento?: string
          favorecido_id?: string | null
          id?: string
          meio?: Database["public"]["Enums"]["meio_pagamento"]
          obra_id?: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_favorecido_id_fkey"
            columns: ["favorecido_id"]
            isOneToOne: false
            referencedRelation: "favorecido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamento_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento_diferenca: {
        Row: {
          encargos: number
          nao_explicado: number
          pagamento_id: string
          resolucao: Database["public"]["Enums"]["resolucao_diferenca"] | null
          resolvido_em: string | null
        }
        Insert: {
          encargos?: number
          nao_explicado?: number
          pagamento_id: string
          resolucao?: Database["public"]["Enums"]["resolucao_diferenca"] | null
          resolvido_em?: string | null
        }
        Update: {
          encargos?: number
          nao_explicado?: number
          pagamento_id?: string
          resolucao?: Database["public"]["Enums"]["resolucao_diferenca"] | null
          resolvido_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_diferenca_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: true
            referencedRelation: "pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento_documento: {
        Row: {
          documento_id: string
          pagamento_id: string
        }
        Insert: {
          documento_id: string
          pagamento_id: string
        }
        Update: {
          documento_id?: string
          pagamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_documento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamento_documento_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      quitacao_recusada: {
        Row: {
          compromisso_id: string
          pagamento_id: string
          recusado_em: string
        }
        Insert: {
          compromisso_id: string
          pagamento_id: string
          recusado_em?: string
        }
        Update: {
          compromisso_id?: string
          pagamento_id?: string
          recusado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "quitacao_recusada_compromisso_id_fkey"
            columns: ["compromisso_id"]
            isOneToOne: false
            referencedRelation: "compromisso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quitacao_recusada_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      terreno_desembolso: {
        Row: {
          arquivo_path: string | null
          created_at: string
          data_pagamento: string | null
          estado: Database["public"]["Enums"]["estado_desembolso_terreno"]
          id: string
          obra_id: string
          origem_recurso:
            | Database["public"]["Enums"]["origem_recurso_entrada"]
            | null
          tipo: Database["public"]["Enums"]["tipo_desembolso_terreno"]
          user_id: string
          valor: number
        }
        Insert: {
          arquivo_path?: string | null
          created_at?: string
          data_pagamento?: string | null
          estado: Database["public"]["Enums"]["estado_desembolso_terreno"]
          id?: string
          obra_id: string
          origem_recurso?:
            | Database["public"]["Enums"]["origem_recurso_entrada"]
            | null
          tipo: Database["public"]["Enums"]["tipo_desembolso_terreno"]
          user_id?: string
          valor: number
        }
        Update: {
          arquivo_path?: string | null
          created_at?: string
          data_pagamento?: string | null
          estado?: Database["public"]["Enums"]["estado_desembolso_terreno"]
          id?: string
          obra_id?: string
          origem_recurso?:
            | Database["public"]["Enums"]["origem_recurso_entrada"]
            | null
          tipo?: Database["public"]["Enums"]["tipo_desembolso_terreno"]
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "terreno_desembolso_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra"
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
      classificacao: "material" | "mao_obra"
      estado_desembolso_terreno: "pago" | "previsto"
      meio_pagamento: "pix" | "boleto" | "cartao"
      natureza_aquisicao_terreno:
        | "a_vista"
        | "financiado"
        | "parcelado_vendedor"
        | "recebido"
      origem_compromisso: "boleto" | "pix" | "cartao"
      origem_recurso_entrada: "proprio" | "fgts"
      resolucao_diferenca:
        | "nao_compoe_custo"
        | "falta_documento"
        | "multiplos_documentos"
        | "erro_digitacao"
        | "previsao_errada"
      situacao_compromisso: "aberto" | "quitado" | "cancelado"
      status_documento: "registrado" | "quarentena" | "aguardando_pagamento"
      status_pagamento: "aguardando_nf" | "conciliado"
      tipo_desembolso_terreno:
        | "pagamento_terreno"
        | "entrada"
        | "itbi"
        | "escritura_registro"
        | "parcela_vendedor"
        | "quitacao"
      tipo_documento: "nf_material" | "nf_servico" | "boleto"
      tipo_favorecido: "pj" | "pf"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      classificacao: ["material", "mao_obra"],
      estado_desembolso_terreno: ["pago", "previsto"],
      meio_pagamento: ["pix", "boleto", "cartao"],
      natureza_aquisicao_terreno: [
        "a_vista",
        "financiado",
        "parcelado_vendedor",
        "recebido",
      ],
      origem_compromisso: ["boleto", "pix", "cartao"],
      origem_recurso_entrada: ["proprio", "fgts"],
      resolucao_diferenca: [
        "nao_compoe_custo",
        "falta_documento",
        "multiplos_documentos",
        "erro_digitacao",
        "previsao_errada",
      ],
      situacao_compromisso: ["aberto", "quitado", "cancelado"],
      status_documento: ["registrado", "quarentena", "aguardando_pagamento"],
      status_pagamento: ["aguardando_nf", "conciliado"],
      tipo_desembolso_terreno: [
        "pagamento_terreno",
        "entrada",
        "itbi",
        "escritura_registro",
        "parcela_vendedor",
        "quitacao",
      ],
      tipo_documento: ["nf_material", "nf_servico", "boleto"],
      tipo_favorecido: ["pj", "pf"],
    },
  },
} as const

