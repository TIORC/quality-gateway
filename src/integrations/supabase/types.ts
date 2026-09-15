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
