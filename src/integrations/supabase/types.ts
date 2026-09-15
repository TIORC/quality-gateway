/**
 * Tipos do banco do Lovable Cloud (Supabase).
 *
 * Formato equivalente ao gerado pelo Supabase CLI — mantenha em sincronia com
 * `supabase/migrations/20260915000000_pops.sql`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      pop_setores: {
        Row: {
          id: string;
          nome: string;
          prefixo: string;
          categoria: string;
          icone: string;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          prefixo: string;
          categoria: string;
          icone?: string;
          ordem?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          prefixo?: string;
          categoria?: string;
          icone?: string;
          ordem?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      pops: {
        Row: {
          id: string;
          setor_id: string;
          codigo: string;
          titulo: string;
          descricao: string;
          departamento: string;
          categoria: string;
          frequencia: string;
          prazo_referencia: string;
          regime: string;
          dificuldade: string;
          cargo_responsavel: string;
          dia_inicio: number | null;
          meta_dia: number | null;
          prazo_legal: string | null;
          favoritos: number;
          anotacoes: number;
          arquivo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          setor_id: string;
          codigo: string;
          titulo: string;
          descricao?: string;
          departamento?: string;
          categoria?: string;
          frequencia?: string;
          prazo_referencia?: string;
          regime?: string;
          dificuldade?: string;
          cargo_responsavel?: string;
          dia_inicio?: number | null;
          meta_dia?: number | null;
          prazo_legal?: string | null;
          favoritos?: number;
          anotacoes?: number;
          arquivo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          setor_id?: string;
          codigo?: string;
          titulo?: string;
          descricao?: string;
          departamento?: string;
          categoria?: string;
          frequencia?: string;
          prazo_referencia?: string;
          regime?: string;
          dificuldade?: string;
          cargo_responsavel?: string;
          dia_inicio?: number | null;
          meta_dia?: number | null;
          prazo_legal?: string | null;
          favoritos?: number;
          anotacoes?: number;
          arquivo?: string | null;
          created_at?: string;
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
      planos_de_acao: {
        Row: {
          id: string;
          titulo: string;
          descricao: string;
          detalhamento: string;
          status: string;
          origem: string;
          setor: string;
          prioridade: string;
          responsavel_nome: string;
          responsavel_email: string;
          seguidores: string[];
          prazo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          titulo: string;
          descricao?: string;
          detalhamento?: string;
          status?: string;
          origem?: string;
          setor?: string;
          prioridade?: string;
          responsavel_nome?: string;
          responsavel_email?: string;
          seguidores?: string[];
          prazo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          titulo?: string;
          descricao?: string;
          detalhamento?: string;
          status?: string;
          origem?: string;
          setor?: string;
          prioridade?: string;
          responsavel_nome?: string;
          responsavel_email?: string;
          seguidores?: string[];
          prazo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pop_anotacoes: {
        Row: {
          id: string;
          pop_id: string;
          autor_nome: string;
          autor_email: string;
          mensagem: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          pop_id: string;
          autor_nome?: string;
          autor_email?: string;
          mensagem?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          pop_id?: string;
          autor_nome?: string;
          autor_email?: string;
          mensagem?: string;
          created_at?: string;
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
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type PopSetorRow = Database["public"]["Tables"]["pop_setores"]["Row"];
export type PopRow = Database["public"]["Tables"]["pops"]["Row"];
export type PopInsert = Database["public"]["Tables"]["pops"]["Insert"];
export type PopUpdate = Database["public"]["Tables"]["pops"]["Update"];
export type PopAnotacaoRow = Database["public"]["Tables"]["pop_anotacoes"]["Row"];
export type PopAnotacaoInsert = Database["public"]["Tables"]["pop_anotacoes"]["Insert"];
export type PopAnotacaoUpdate = Database["public"]["Tables"]["pop_anotacoes"]["Update"];
export type PlanoDeAcaoRow = Database["public"]["Tables"]["planos_de_acao"]["Row"];
export type PlanoDeAcaoInsert = Database["public"]["Tables"]["planos_de_acao"]["Insert"];
export type PlanoDeAcaoUpdate = Database["public"]["Tables"]["planos_de_acao"]["Update"];
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
