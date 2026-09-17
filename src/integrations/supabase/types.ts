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
      cargos: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          setor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nome: string
          ordem?: number
          setor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          setor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          cargo: string
          cidade: string
          created_at: string
          email: string
          exclusao: string
          grupos: string
          id: string
          nivel_acesso: string
          nome: string
          processos_lidos: number
          processos_visualizados: number
          setor: string
          status: string
          ultimo_acesso: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          cargo?: string
          cidade?: string
          created_at?: string
          email?: string
          exclusao?: string
          grupos?: string
          id: string
          nivel_acesso?: string
          nome: string
          processos_lidos?: number
          processos_visualizados?: number
          setor?: string
          status?: string
          ultimo_acesso?: string | null
          unidade?: string
          updated_at?: string
        }
        Update: {
          cargo?: string
          cidade?: string
          created_at?: string
          email?: string
          exclusao?: string
          grupos?: string
          id?: string
          nivel_acesso?: string
          nome?: string
          processos_lidos?: number
          processos_visualizados?: number
          setor?: string
          status?: string
          ultimo_acesso?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      documentos_liberados: {
        Row: {
          colaborador_id: string
          created_at: string
          criado_por: string
          documento_id: string
          documento_tipo: string
          id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          criado_por?: string
          documento_id: string
          documento_tipo?: string
          id?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          criado_por?: string
          documento_id?: string
          documento_tipo?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_liberados_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_liberados_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "pops"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          created_at: string
          filial: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          filial?: string
          id: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          filial?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          autor_email: string
          autor_nome: string
          created_at: string
          destinatario_email: string
          destinatario_nome: string
          id: string
          lida: boolean
          mensagem: string
          pop_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          autor_email?: string
          autor_nome?: string
          created_at?: string
          destinatario_email: string
          destinatario_nome?: string
          id?: string
          lida?: boolean
          mensagem?: string
          pop_id?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          autor_email?: string
          autor_nome?: string
          created_at?: string
          destinatario_email?: string
          destinatario_nome?: string
          id?: string
          lida?: boolean
          mensagem?: string
          pop_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "pops"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_de_acao: {
        Row: {
          created_at: string
          descricao: string
          detalhamento: string
          id: string
          origem: string
          prazo: string | null
          prioridade: string
          responsavel_email: string
          responsavel_nome: string
          seguidores: string[]
          setor: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string
          detalhamento?: string
          id?: string
          origem?: string
          prazo?: string | null
          prioridade?: string
          responsavel_email?: string
          responsavel_nome?: string
          seguidores?: string[]
          setor?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          detalhamento?: string
          id?: string
          origem?: string
          prazo?: string | null
          prioridade?: string
          responsavel_email?: string
          responsavel_nome?: string
          seguidores?: string[]
          setor?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      politicas: {
        Row: {
          anexo: Json | null
          aplicabilidade: string
          codigo: string
          created_at: string
          criado_por: string
          criado_por_nome: string
          data_postagem: string
          data_revisao: string
          data_vencimento: string
          historico: Json
          id: string
          links: string[]
          objetivo: string
          observacao_revisao: string
          parecer: Json | null
          revisao: number
          setores: string[]
          status: string
          sugestoes: Json
          titulo: string
          updated_at: string
        }
        Insert: {
          anexo?: Json | null
          aplicabilidade?: string
          codigo: string
          created_at?: string
          criado_por?: string
          criado_por_nome?: string
          data_postagem?: string
          data_revisao?: string
          data_vencimento?: string
          historico?: Json
          id?: string
          links?: string[]
          objetivo?: string
          observacao_revisao?: string
          parecer?: Json | null
          revisao?: number
          setores?: string[]
          status?: string
          sugestoes?: Json
          titulo: string
          updated_at?: string
        }
        Update: {
          anexo?: Json | null
          aplicabilidade?: string
          codigo?: string
          created_at?: string
          criado_por?: string
          criado_por_nome?: string
          data_postagem?: string
          data_revisao?: string
          data_vencimento?: string
          historico?: Json
          id?: string
          links?: string[]
          objetivo?: string
          observacao_revisao?: string
          parecer?: Json | null
          revisao?: number
          setores?: string[]
          status?: string
          sugestoes?: Json
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      pop_anotacoes: {
        Row: {
          autor_email: string
          autor_nome: string
          created_at: string
          id: string
          mensagem: string
          pop_id: string
        }
        Insert: {
          autor_email?: string
          autor_nome?: string
          created_at?: string
          id?: string
          mensagem?: string
          pop_id: string
        }
        Update: {
          autor_email?: string
          autor_nome?: string
          created_at?: string
          id?: string
          mensagem?: string
          pop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_anotacoes_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "pops"
            referencedColumns: ["id"]
          },
        ]
      }
      pop_favoritos: {
        Row: {
          colaborador_id: string | null
          created_at: string
          pop_id: string
          usuario_email: string
          usuario_nome: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          pop_id: string
          usuario_email: string
          usuario_nome?: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          pop_id?: string
          usuario_email?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_favoritos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_favoritos_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "pops"
            referencedColumns: ["id"]
          },
        ]
      }
      pop_leituras: {
        Row: {
          created_at: string
          decisao: string
          id: string
          justificativa: string
          pop_id: string
          updated_at: string
          usuario_email: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          decisao: string
          id?: string
          justificativa?: string
          pop_id: string
          updated_at?: string
          usuario_email: string
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          decisao?: string
          id?: string
          justificativa?: string
          pop_id?: string
          updated_at?: string
          usuario_email?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_leituras_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "pops"
            referencedColumns: ["id"]
          },
        ]
      }
      pop_revisoes: {
        Row: {
          codigo: string
          conteudo: Json
          created_at: string
          criado_por: string
          criado_por_nome: string
          data_revisao: string
          id: string
          observacao: string
          pop_id: string
          revisao: number
        }
        Insert: {
          codigo?: string
          conteudo?: Json
          created_at?: string
          criado_por?: string
          criado_por_nome?: string
          data_revisao?: string
          id?: string
          observacao?: string
          pop_id: string
          revisao: number
        }
        Update: {
          codigo?: string
          conteudo?: Json
          created_at?: string
          criado_por?: string
          criado_por_nome?: string
          data_revisao?: string
          id?: string
          observacao?: string
          pop_id?: string
          revisao?: number
        }
        Relationships: [
          {
            foreignKeyName: "pop_revisoes_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "pops"
            referencedColumns: ["id"]
          },
        ]
      }
      pop_setores: {
        Row: {
          categoria: string
          created_at: string
          icone: string
          id: string
          nome: string
          ordem: number
          prefixo: string
        }
        Insert: {
          categoria: string
          created_at?: string
          icone?: string
          id: string
          nome: string
          ordem?: number
          prefixo: string
        }
        Update: {
          categoria?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
          ordem?: number
          prefixo?: string
        }
        Relationships: []
      }
      pop_sugestoes: {
        Row: {
          created_at: string
          id: string
          pop_id: string
          status: string
          sugestao: string
          updated_at: string
          usuario_email: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          pop_id: string
          status?: string
          sugestao: string
          updated_at?: string
          usuario_email: string
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          id?: string
          pop_id?: string
          status?: string
          sugestao?: string
          updated_at?: string
          usuario_email?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_sugestoes_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "pops"
            referencedColumns: ["id"]
          },
        ]
      }
      pop_visualizacoes: {
        Row: {
          created_at: string
          pop_id: string
          updated_at: string
          usuario_email: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          pop_id: string
          updated_at?: string
          usuario_email: string
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          pop_id?: string
          updated_at?: string
          usuario_email?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_visualizacoes_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "pops"
            referencedColumns: ["id"]
          },
        ]
      }
      pops: {
        Row: {
          anotacoes: number
          aprovado_processo_em: string | null
          aprovado_processo_nome: string
          aprovado_processo_por: string
          aprovado_qualidade_em: string | null
          aprovado_qualidade_nome: string
          aprovado_qualidade_por: string
          arquivo: string | null
          arquivo_nome: string | null
          arquivo_path: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          cargo_responsavel: string
          categoria: string
          codigo: string
          created_at: string
          criado_por: string
          criado_por_nome: string
          data_revisao: string
          data_vencimento: string | null
          departamento: string
          descricao: string
          dia_inicio: number | null
          dificuldade: string
          documentos_gerados: string
          etapas: Json
          favoritos: number
          frequencia: string
          id: string
          links_relacionados: string[]
          materiais_sistemas: string
          meta_dia: number | null
          objetivo: string
          observacao_revisao: string
          observacoes: string
          prazo_legal: string | null
          prazo_referencia: string
          regime: string
          revisao: number
          setor_id: string
          setores_responsaveis: string[]
          status: string
          titulo: string
          updated_at: string
          visualizadores: string[]
        }
        Insert: {
          anotacoes?: number
          aprovado_processo_em?: string | null
          aprovado_processo_nome?: string
          aprovado_processo_por?: string
          aprovado_qualidade_em?: string | null
          aprovado_qualidade_nome?: string
          aprovado_qualidade_por?: string
          arquivo?: string | null
          arquivo_nome?: string | null
          arquivo_path?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          cargo_responsavel?: string
          categoria?: string
          codigo: string
          created_at?: string
          criado_por?: string
          criado_por_nome?: string
          data_revisao?: string
          data_vencimento?: string | null
          departamento?: string
          descricao?: string
          dia_inicio?: number | null
          dificuldade?: string
          documentos_gerados?: string
          etapas?: Json
          favoritos?: number
          frequencia?: string
          id?: string
          links_relacionados?: string[]
          materiais_sistemas?: string
          meta_dia?: number | null
          objetivo?: string
          observacao_revisao?: string
          observacoes?: string
          prazo_legal?: string | null
          prazo_referencia?: string
          regime?: string
          revisao?: number
          setor_id: string
          setores_responsaveis?: string[]
          status?: string
          titulo: string
          updated_at?: string
          visualizadores?: string[]
        }
        Update: {
          anotacoes?: number
          aprovado_processo_em?: string | null
          aprovado_processo_nome?: string
          aprovado_processo_por?: string
          aprovado_qualidade_em?: string | null
          aprovado_qualidade_nome?: string
          aprovado_qualidade_por?: string
          arquivo?: string | null
          arquivo_nome?: string | null
          arquivo_path?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          cargo_responsavel?: string
          categoria?: string
          codigo?: string
          created_at?: string
          criado_por?: string
          criado_por_nome?: string
          data_revisao?: string
          data_vencimento?: string | null
          departamento?: string
          descricao?: string
          dia_inicio?: number | null
          dificuldade?: string
          documentos_gerados?: string
          etapas?: Json
          favoritos?: number
          frequencia?: string
          id?: string
          links_relacionados?: string[]
          materiais_sistemas?: string
          meta_dia?: number | null
          objetivo?: string
          observacao_revisao?: string
          observacoes?: string
          prazo_legal?: string | null
          prazo_referencia?: string
          regime?: string
          revisao?: number
          setor_id?: string
          setores_responsaveis?: string[]
          status?: string
          titulo?: string
          updated_at?: string
          visualizadores?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "pops_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "pop_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          cidade: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          cidade?: string
          created_at?: string
          id: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          cidade?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean
          cargo: string
          colaborador_id: string | null
          created_at: string
          email: string
          id: string
          nome: string
          role: string
          senha_hash: string
          senha_salt: string
          setor: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string
          colaborador_id?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          role?: string
          senha_hash: string
          senha_salt: string
          setor?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string
          colaborador_id?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          role?: string
          senha_hash?: string
          senha_salt?: string
          setor?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pop_recalcular_contadores: { Args: { alvo: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
