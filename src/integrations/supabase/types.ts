export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      planos_de_acao: {
        Row: {
          created_at: string;
          descricao: string;
          detalhamento: string;
          id: string;
          origem: string;
          prazo: string | null;
          prioridade: string;
          responsavel_email: string;
          responsavel_nome: string;
          seguidores: string[];
          setor: string;
          status: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          descricao?: string;
          detalhamento?: string;
          id?: string;
          origem?: string;
          prazo?: string | null;
          prioridade?: string;
          responsavel_email?: string;
          responsavel_nome?: string;
          seguidores?: string[];
          setor?: string;
          status?: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          descricao?: string;
          detalhamento?: string;
          id?: string;
          origem?: string;
          prazo?: string | null;
          prioridade?: string;
          responsavel_email?: string;
          responsavel_nome?: string;
          seguidores?: string[];
          setor?: string;
          status?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pop_anotacoes: {
        Row: {
          autor_email: string;
          autor_nome: string;
          created_at: string;
          id: string;
          mensagem: string;
          pop_id: string;
        };
        Insert: {
          autor_email?: string;
          autor_nome?: string;
          created_at?: string;
          id?: string;
          mensagem?: string;
          pop_id: string;
        };
        Update: {
          autor_email?: string;
          autor_nome?: string;
          created_at?: string;
          id?: string;
          mensagem?: string;
          pop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pop_anotacoes_pop_id_fkey";
            columns: ["pop_id"];
            isOneToOne: false;
            referencedRelation: "pops";
            referencedColumns: ["id"];
          },
        ];
      };
      pop_favoritos: {
        Row: {
          colaborador_id: string | null;
          created_at: string;
          pop_id: string;
          usuario_email: string;
          usuario_nome: string;
        };
        Insert: {
          colaborador_id?: string | null;
          created_at?: string;
          pop_id: string;
          usuario_email: string;
          usuario_nome?: string;
        };
        Update: {
          colaborador_id?: string | null;
          created_at?: string;
          pop_id?: string;
          usuario_email?: string;
          usuario_nome?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pop_favoritos_pop_id_fkey";
            columns: ["pop_id"];
            isOneToOne: false;
            referencedRelation: "pops";
            referencedColumns: ["id"];
          },
        ];
      };
      pop_setores: {
        Row: {
          categoria: string;
          created_at: string;
          icone: string;
          id: string;
          nome: string;
          ordem: number;
          prefixo: string;
        };
        Insert: {
          categoria: string;
          created_at?: string;
          icone?: string;
          id: string;
          nome: string;
          ordem?: number;
          prefixo: string;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          icone?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          prefixo?: string;
        };
        Relationships: [];
      };
      pop_leituras: {
        Row: {
          created_at: string;
          decisao: string;
          id: string;
          justificativa: string;
          pop_id: string;
          updated_at: string;
          usuario_email: string;
          usuario_nome: string;
        };
        Insert: {
          created_at?: string;
          decisao: string;
          id?: string;
          justificativa?: string;
          pop_id: string;
          updated_at?: string;
          usuario_email: string;
          usuario_nome?: string;
        };
        Update: {
          created_at?: string;
          decisao?: string;
          id?: string;
          justificativa?: string;
          pop_id?: string;
          updated_at?: string;
          usuario_email?: string;
          usuario_nome?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pop_leituras_pop_id_fkey";
            columns: ["pop_id"];
            isOneToOne: false;
            referencedRelation: "pops";
            referencedColumns: ["id"];
          },
        ];
      };
      pop_visualizacoes: {
        Row: {
          created_at: string;
          pop_id: string;
          updated_at: string;
          usuario_email: string;
          usuario_nome: string;
        };
        Insert: {
          created_at?: string;
          pop_id: string;
          updated_at?: string;
          usuario_email: string;
          usuario_nome?: string;
        };
        Update: {
          created_at?: string;
          pop_id?: string;
          updated_at?: string;
          usuario_email?: string;
          usuario_nome?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pop_visualizacoes_pop_id_fkey";
            columns: ["pop_id"];
            isOneToOne: false;
            referencedRelation: "pops";
            referencedColumns: ["id"];
          },
        ];
      };
      notificacoes: {
        Row: {
          autor_email: string;
          autor_nome: string;
          created_at: string;
          destinatario_email: string;
          destinatario_nome: string;
          id: string;
          lida: boolean;
          mensagem: string;
          pop_id: string | null;
          titulo: string;
          tipo: string;
        };
        Insert: {
          autor_email?: string;
          autor_nome?: string;
          created_at?: string;
          destinatario_email: string;
          destinatario_nome?: string;
          id?: string;
          lida?: boolean;
          mensagem?: string;
          pop_id?: string | null;
          titulo: string;
          tipo?: string;
        };
        Update: {
          autor_email?: string;
          autor_nome?: string;
          created_at?: string;
          destinatario_email?: string;
          destinatario_nome?: string;
          id?: string;
          lida?: boolean;
          mensagem?: string;
          pop_id?: string | null;
          titulo?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notificacoes_pop_id_fkey";
            columns: ["pop_id"];
            isOneToOne: false;
            referencedRelation: "pops";
            referencedColumns: ["id"];
          },
        ];
      };
      pops: {
        Row: {
          anotacoes: number;
          arquivo: string | null;
          arquivo_nome: string | null;
          arquivo_path: string | null;
          arquivo_tamanho: number | null;
          arquivo_tipo: string | null;
          cargo_responsavel: string;
          categoria: string;
          codigo: string;
          created_at: string;
          departamento: string;
          descricao: string;
          dia_inicio: number | null;
          dificuldade: string;
          documentos_gerados: string;
          etapas: Json;
          favoritos: number;
          frequencia: string;
          id: string;
          links_relacionados: string[];
          materiais_sistemas: string;
          meta_dia: number | null;
          objetivo: string;
          observacoes: string;
          prazo_legal: string | null;
          prazo_referencia: string;
          regime: string;
          setor_id: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          anotacoes?: number;
          arquivo?: string | null;
          arquivo_nome?: string | null;
          arquivo_path?: string | null;
          arquivo_tamanho?: number | null;
          arquivo_tipo?: string | null;
          cargo_responsavel?: string;
          categoria?: string;
          codigo: string;
          created_at?: string;
          departamento?: string;
          descricao?: string;
          dia_inicio?: number | null;
          dificuldade?: string;
          documentos_gerados?: string;
          etapas?: Json;
          favoritos?: number;
          frequencia?: string;
          id?: string;
          links_relacionados?: string[];
          materiais_sistemas?: string;
          meta_dia?: number | null;
          objetivo?: string;
          observacoes?: string;
          prazo_legal?: string | null;
          prazo_referencia?: string;
          regime?: string;
          setor_id: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          anotacoes?: number;
          arquivo?: string | null;
          arquivo_nome?: string | null;
          arquivo_path?: string | null;
          arquivo_tamanho?: number | null;
          arquivo_tipo?: string | null;
          cargo_responsavel?: string;
          categoria?: string;
          codigo?: string;
          created_at?: string;
          departamento?: string;
          descricao?: string;
          dia_inicio?: number | null;
          dificuldade?: string;
          documentos_gerados?: string;
          etapas?: Json;
          favoritos?: number;
          frequencia?: string;
          id?: string;
          links_relacionados?: string[];
          materiais_sistemas?: string;
          meta_dia?: number | null;
          objetivo?: string;
          observacoes?: string;
          prazo_legal?: string | null;
          prazo_referencia?: string;
          regime?: string;
          setor_id?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pops_setor_id_fkey";
            columns: ["setor_id"];
            isOneToOne: false;
            referencedRelation: "pop_setores";
            referencedColumns: ["id"];
          },
        ];
      };
      empresas: {
        Row: {
          id: string;
          nome: string;
          filial: string;
          ordem: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          filial?: string;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          filial?: string;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      setores: {
        Row: {
          id: string;
          nome: string;
          ordem: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cargos: {
        Row: {
          id: string;
          setor_id: string;
          nome: string;
          ordem: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          setor_id: string;
          nome: string;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          setor_id?: string;
          nome?: string;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cargos_setor_id_fkey";
            columns: ["setor_id"];
            isOneToOne: false;
            referencedRelation: "setores";
            referencedColumns: ["id"];
          },
        ];
      };
      unidades: {
        Row: {
          id: string;
          nome: string;
          cidade: string;
          ordem: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          cidade?: string;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          cidade?: string;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      colaboradores: {
        Row: {
          id: string;
          nome: string;
          email: string;
          cargo: string;
          unidade: string;
          cidade: string;
          setor: string;
          nivel_acesso: string;
          grupos: string;
          exclusao: string;
          status: string;
          ultimo_acesso: string | null;
          processos_visualizados: number;
          processos_lidos: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          email?: string;
          cargo?: string;
          unidade?: string;
          cidade?: string;
          setor?: string;
          nivel_acesso?: string;
          grupos?: string;
          exclusao?: string;
          status?: string;
          ultimo_acesso?: string | null;
          processos_visualizados?: number;
          processos_lidos?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          email?: string;
          cargo?: string;
          unidade?: string;
          cidade?: string;
          setor?: string;
          nivel_acesso?: string;
          grupos?: string;
          exclusao?: string;
          status?: string;
          ultimo_acesso?: string | null;
          processos_visualizados?: number;
          processos_lidos?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          nome: string;
          email: string;
          senha_salt: string;
          senha_hash: string;
          role: string;
          cargo: string;
          setor: string;
          colaborador_id: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          email: string;
          senha_salt: string;
          senha_hash: string;
          role?: string;
          cargo?: string;
          setor?: string;
          colaborador_id?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          email?: string;
          senha_salt?: string;
          senha_hash?: string;
          role?: string;
          cargo?: string;
          setor?: string;
          colaborador_id?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documentos_liberados: {
        Row: {
          id: string;
          colaborador_id: string;
          documento_tipo: string;
          documento_id: string;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          colaborador_id: string;
          documento_tipo?: string;
          documento_id: string;
          criado_por?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          colaborador_id?: string;
          documento_tipo?: string;
          documento_id?: string;
          criado_por?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

export type PopSetorRow = Database["public"]["Tables"]["pop_setores"]["Row"];
export type PopRow = Database["public"]["Tables"]["pops"]["Row"];
export type PopInsert = Database["public"]["Tables"]["pops"]["Insert"];
export type PopUpdate = Database["public"]["Tables"]["pops"]["Update"];
export type PopAnotacaoRow = Database["public"]["Tables"]["pop_anotacoes"]["Row"];
export type PopAnotacaoInsert = Database["public"]["Tables"]["pop_anotacoes"]["Insert"];
export type PopAnotacaoUpdate = Database["public"]["Tables"]["pop_anotacoes"]["Update"];
export type PopFavoritoRow = Database["public"]["Tables"]["pop_favoritos"]["Row"];
export type PopFavoritoInsert = Database["public"]["Tables"]["pop_favoritos"]["Insert"];
export type PopFavoritoUpdate = Database["public"]["Tables"]["pop_favoritos"]["Update"];
export type PopLeituraRow = Database["public"]["Tables"]["pop_leituras"]["Row"];
export type PopLeituraInsert = Database["public"]["Tables"]["pop_leituras"]["Insert"];
export type PopLeituraUpdate = Database["public"]["Tables"]["pop_leituras"]["Update"];
export type PopVisualizacaoRow = Database["public"]["Tables"]["pop_visualizacoes"]["Row"];
export type PopVisualizacaoInsert = Database["public"]["Tables"]["pop_visualizacoes"]["Insert"];
export type PopVisualizacaoUpdate = Database["public"]["Tables"]["pop_visualizacoes"]["Update"];
export type NotificacaoRow = Database["public"]["Tables"]["notificacoes"]["Row"];
export type NotificacaoInsert = Database["public"]["Tables"]["notificacoes"]["Insert"];
export type NotificacaoUpdate = Database["public"]["Tables"]["notificacoes"]["Update"];
export type PlanoDeAcaoRow = Database["public"]["Tables"]["planos_de_acao"]["Row"];
export type PlanoDeAcaoInsert = Database["public"]["Tables"]["planos_de_acao"]["Insert"];
export type PlanoDeAcaoUpdate = Database["public"]["Tables"]["planos_de_acao"]["Update"];
export type EmpresaRow = Database["public"]["Tables"]["empresas"]["Row"];
export type EmpresaInsert = Database["public"]["Tables"]["empresas"]["Insert"];
export type EmpresaUpdate = Database["public"]["Tables"]["empresas"]["Update"];
export type SetorRow = Database["public"]["Tables"]["setores"]["Row"];
export type SetorInsert = Database["public"]["Tables"]["setores"]["Insert"];
export type SetorUpdate = Database["public"]["Tables"]["setores"]["Update"];
export type CargoRow = Database["public"]["Tables"]["cargos"]["Row"];
export type CargoInsert = Database["public"]["Tables"]["cargos"]["Insert"];
export type CargoUpdate = Database["public"]["Tables"]["cargos"]["Update"];
export type UnidadeRow = Database["public"]["Tables"]["unidades"]["Row"];
export type UnidadeInsert = Database["public"]["Tables"]["unidades"]["Insert"];
export type UnidadeUpdate = Database["public"]["Tables"]["unidades"]["Update"];
export type ColaboradorRow = Database["public"]["Tables"]["colaboradores"]["Row"];
export type ColaboradorInsert = Database["public"]["Tables"]["colaboradores"]["Insert"];
export type ColaboradorUpdate = Database["public"]["Tables"]["colaboradores"]["Update"];
export type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
export type UsuarioInsert = Database["public"]["Tables"]["usuarios"]["Insert"];
export type UsuarioUpdate = Database["public"]["Tables"]["usuarios"]["Update"];
export type DocumentoLiberadoRow = Database["public"]["Tables"]["documentos_liberados"]["Row"];
export type DocumentoLiberadoInsert =
  Database["public"]["Tables"]["documentos_liberados"]["Insert"];
