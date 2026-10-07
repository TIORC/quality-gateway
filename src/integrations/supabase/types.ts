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
      apuracoes: {
        Row: {
          created_at: string
          fechado: boolean
          id: string
          indicador_id: string
          lancado_em: string | null
          lancado_por: string
          mes_referencia: string
          meta_no_mes: number | null
          plano_acao_id: string | null
          status: string
          updated_at: string
          valor_realizado: number | null
        }
        Insert: {
          created_at?: string
          fechado?: boolean
          id?: string
          indicador_id: string
          lancado_em?: string | null
          lancado_por?: string
          mes_referencia: string
          meta_no_mes?: number | null
          plano_acao_id?: string | null
          status?: string
          updated_at?: string
          valor_realizado?: number | null
        }
        Update: {
          created_at?: string
          fechado?: boolean
          id?: string
          indicador_id?: string
          lancado_em?: string | null
          lancado_por?: string
          mes_referencia?: string
          meta_no_mes?: number | null
          plano_acao_id?: string | null
          status?: string
          updated_at?: string
          valor_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apuracoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "indicadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apuracoes_plano_acao_id_fkey"
            columns: ["plano_acao_id"]
            isOneToOne: false
            referencedRelation: "planos_de_acao"
            referencedColumns: ["id"]
          },
        ]
      }
      ata_acoes: {
        Row: {
          ata: string
          descricao: string
          id: string
          plano_acao: string | null
          prazo: string | null
          responsavel: string | null
          setor_destino: string
          status_sugestao: string
          trecho_origem: string
        }
        Insert: {
          ata: string
          descricao?: string
          id?: string
          plano_acao?: string | null
          prazo?: string | null
          responsavel?: string | null
          setor_destino: string
          status_sugestao?: string
          trecho_origem?: string
        }
        Update: {
          ata?: string
          descricao?: string
          id?: string
          plano_acao?: string | null
          prazo?: string | null
          responsavel?: string | null
          setor_destino?: string
          status_sugestao?: string
          trecho_origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "ata_acoes_ata_fkey"
            columns: ["ata"]
            isOneToOne: false
            referencedRelation: "atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ata_acoes_plano_acao_fkey"
            columns: ["plano_acao"]
            isOneToOne: false
            referencedRelation: "planos_de_acao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ata_acoes_responsavel_fkey"
            columns: ["responsavel"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ata_acoes_setor_destino_fkey"
            columns: ["setor_destino"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      ata_arquivos: {
        Row: {
          arquivo: string
          ata: string
          enviado_em: string
          enviado_por: string
          id: string
          nome_original: string
          tamanho: number
        }
        Insert: {
          arquivo?: string
          ata: string
          enviado_em?: string
          enviado_por: string
          id?: string
          nome_original?: string
          tamanho?: number
        }
        Update: {
          arquivo?: string
          ata?: string
          enviado_em?: string
          enviado_por?: string
          id?: string
          nome_original?: string
          tamanho?: number
        }
        Relationships: [
          {
            foreignKeyName: "ata_arquivos_ata_fkey"
            columns: ["ata"]
            isOneToOne: false
            referencedRelation: "atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ata_arquivos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ata_assinaturas: {
        Row: {
          assinado_em: string
          ata: string
          hash_conteudo: string
          id: string
          usuario: string
        }
        Insert: {
          assinado_em?: string
          ata: string
          hash_conteudo?: string
          id?: string
          usuario: string
        }
        Update: {
          assinado_em?: string
          ata?: string
          hash_conteudo?: string
          id?: string
          usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "ata_assinaturas_ata_fkey"
            columns: ["ata"]
            isOneToOne: false
            referencedRelation: "atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ata_assinaturas_usuario_fkey"
            columns: ["usuario"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ata_setores_citados: {
        Row: {
          ata: string
          id: string
          setor: string
          trecho: string
        }
        Insert: {
          ata: string
          id?: string
          setor: string
          trecho?: string
        }
        Update: {
          ata?: string
          id?: string
          setor?: string
          trecho?: string
        }
        Relationships: [
          {
            foreignKeyName: "ata_setores_citados_ata_fkey"
            columns: ["ata"]
            isOneToOne: false
            referencedRelation: "atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ata_setores_citados_setor_fkey"
            columns: ["setor"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      atas: {
        Row: {
          created_at: string
          criado_por: string
          data_reuniao: string
          id: string
          origem: string
          status: string
          texto: string
          tipo_reuniao: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          data_reuniao: string
          id?: string
          origem?: string
          status?: string
          texto?: string
          tipo_reuniao?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          data_reuniao?: string
          id?: string
          origem?: string
          status?: string
          texto?: string
          tipo_reuniao?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atas_tipo_reuniao_fkey"
            columns: ["tipo_reuniao"]
            isOneToOne: false
            referencedRelation: "tipos_reuniao"
            referencedColumns: ["id"]
          },
        ]
      }
      auditorias: {
        Row: {
          auditados: Json
          auditores: Json
          codigo: string
          created_at: string
          criada_por_email: string
          criada_por_nome: string
          data_planejada: string | null
          evidencias: string
          id: string
          norma: string
          relatorio: string
          resultado: string
          resultado_ref: string
          setores_auditados: Json
          status: string
          tipo: string
          titulo: string
          unidade: string
          updated_at: string
        }
        Insert: {
          auditados?: Json
          auditores?: Json
          codigo?: string
          created_at?: string
          criada_por_email?: string
          criada_por_nome?: string
          data_planejada?: string | null
          evidencias?: string
          id?: string
          norma?: string
          relatorio?: string
          resultado?: string
          resultado_ref?: string
          setores_auditados?: Json
          status?: string
          tipo?: string
          titulo?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          auditados?: Json
          auditores?: Json
          codigo?: string
          created_at?: string
          criada_por_email?: string
          criada_por_nome?: string
          data_planejada?: string | null
          evidencias?: string
          id?: string
          norma?: string
          relatorio?: string
          resultado?: string
          resultado_ref?: string
          setores_auditados?: Json
          status?: string
          tipo?: string
          titulo?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          perm_adicionar_documentos: boolean
          perm_excluir_documentos: boolean
          perm_excluir_planos: boolean
          perm_modificar_documentos: boolean
          permissoes_extras: Json
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
          perm_adicionar_documentos?: boolean
          perm_excluir_documentos?: boolean
          perm_excluir_planos?: boolean
          perm_modificar_documentos?: boolean
          permissoes_extras?: Json
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
          perm_adicionar_documentos?: boolean
          perm_excluir_documentos?: boolean
          perm_excluir_planos?: boolean
          perm_modificar_documentos?: boolean
          permissoes_extras?: Json
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
      grupo_membros: {
        Row: {
          colaborador_id: string
          created_at: string
          grupo_id: string
          id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          grupo_id: string
          id?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          grupo_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_membros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_acessos"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_acessos: {
        Row: {
          created_at: string
          descricao: string
          id: string
          modulos_perm: Json
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string
          id?: string
          modulos_perm?: Json
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          modulos_perm?: Json
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      indicadores: {
        Row: {
          ativo: boolean
          automatico: boolean
          created_at: string
          criado_de_modelo: boolean
          descricao: string
          fonte: string
          formula_descricao: string
          id: string
          meta: number | null
          nome: string
          periodicidade: string
          regra_automatica: string
          responsavel_id: string
          responsavel_nome: string
          sentido: string
          setor: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          automatico?: boolean
          created_at?: string
          criado_de_modelo?: boolean
          descricao?: string
          fonte?: string
          formula_descricao?: string
          id?: string
          meta?: number | null
          nome: string
          periodicidade?: string
          regra_automatica?: string
          responsavel_id?: string
          responsavel_nome?: string
          sentido?: string
          setor?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          automatico?: boolean
          created_at?: string
          criado_de_modelo?: boolean
          descricao?: string
          fonte?: string
          formula_descricao?: string
          id?: string
          meta?: number | null
          nome?: string
          periodicidade?: string
          regra_automatica?: string
          responsavel_id?: string
          responsavel_nome?: string
          sentido?: string
          setor?: string
          unidade?: string
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
          plano_id: string | null
          politica_id: string | null
          pop_id: string | null
          revisao: number | null
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
          plano_id?: string | null
          politica_id?: string | null
          pop_id?: string | null
          revisao?: number | null
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
          plano_id?: string | null
          politica_id?: string | null
          pop_id?: string | null
          revisao?: number | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_de_acao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_politica_id_fkey"
            columns: ["politica_id"]
            isOneToOne: false
            referencedRelation: "politicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "pops"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencia_fluxos: {
        Row: {
          created_at: string
          criado_por_email: string
          criado_por_nome: string
          etapas: Json
          id: string
          publicada: boolean
          tipo_id: string
          versao: number
        }
        Insert: {
          created_at?: string
          criado_por_email?: string
          criado_por_nome?: string
          etapas?: Json
          id?: string
          publicada?: boolean
          tipo_id: string
          versao?: number
        }
        Update: {
          created_at?: string
          criado_por_email?: string
          criado_por_nome?: string
          etapas?: Json
          id?: string
          publicada?: boolean
          tipo_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencia_fluxos_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "ocorrencia_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencia_formularios: {
        Row: {
          campos: Json
          created_at: string
          criado_por_email: string
          criado_por_nome: string
          id: string
          publicada: boolean
          tipo_id: string
          versao: number
        }
        Insert: {
          campos?: Json
          created_at?: string
          criado_por_email?: string
          criado_por_nome?: string
          id?: string
          publicada?: boolean
          tipo_id: string
          versao?: number
        }
        Update: {
          campos?: Json
          created_at?: string
          criado_por_email?: string
          criado_por_nome?: string
          id?: string
          publicada?: boolean
          tipo_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencia_formularios_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "ocorrencia_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencia_historico: {
        Row: {
          acao: string
          anexos: Json
          autor_email: string
          autor_id: string
          autor_nome: string
          comentario: string
          created_at: string
          de: string
          id: string
          macro: string
          ocorrencia_id: string
          para: string
          subetapa: string
        }
        Insert: {
          acao?: string
          anexos?: Json
          autor_email?: string
          autor_id?: string
          autor_nome?: string
          comentario?: string
          created_at?: string
          de?: string
          id?: string
          macro?: string
          ocorrencia_id: string
          para?: string
          subetapa?: string
        }
        Update: {
          acao?: string
          anexos?: Json
          autor_email?: string
          autor_id?: string
          autor_nome?: string
          comentario?: string
          created_at?: string
          de?: string
          id?: string
          macro?: string
          ocorrencia_id?: string
          para?: string
          subetapa?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencia_historico_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencia_tipos: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          descricao: string
          icone: string
          id: string
          nome: string
          ordem: number
          setor_padrao: string
          sla_dias: Json
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          descricao?: string
          icone?: string
          id?: string
          nome: string
          ordem?: number
          setor_padrao?: string
          sla_dias?: Json
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          descricao?: string
          icone?: string
          id?: string
          nome?: string
          ordem?: number
          setor_padrao?: string
          sla_dias?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ocorrencias: {
        Row: {
          aberta_por_email: string
          aberta_por_id: string
          aberta_por_nome: string
          aberta_por_setor: string
          avaliacao: Json | null
          created_at: string
          encerrada_em: string | null
          etapa_entrou_em: string
          fluxo_versao: number
          formulario_versao: number
          id: string
          macro_atual: string
          numero: string
          prazo_etapa: string | null
          procedencia: string
          reaberturas: number
          responsavel_email: string
          responsavel_id: string
          responsavel_nome: string
          respostas: Json
          status: string
          subetapa_atual_id: string
          subetapa_atual_nome: string
          tipo_cor: string
          tipo_id: string
          tipo_nome: string
          titulo: string
          updated_at: string
        }
        Insert: {
          aberta_por_email?: string
          aberta_por_id?: string
          aberta_por_nome?: string
          aberta_por_setor?: string
          avaliacao?: Json | null
          created_at?: string
          encerrada_em?: string | null
          etapa_entrou_em?: string
          fluxo_versao?: number
          formulario_versao?: number
          id?: string
          macro_atual?: string
          numero?: string
          prazo_etapa?: string | null
          procedencia?: string
          reaberturas?: number
          responsavel_email?: string
          responsavel_id?: string
          responsavel_nome?: string
          respostas?: Json
          status?: string
          subetapa_atual_id?: string
          subetapa_atual_nome?: string
          tipo_cor?: string
          tipo_id: string
          tipo_nome?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          aberta_por_email?: string
          aberta_por_id?: string
          aberta_por_nome?: string
          aberta_por_setor?: string
          avaliacao?: Json | null
          created_at?: string
          encerrada_em?: string | null
          etapa_entrou_em?: string
          fluxo_versao?: number
          formulario_versao?: number
          id?: string
          macro_atual?: string
          numero?: string
          prazo_etapa?: string | null
          procedencia?: string
          reaberturas?: number
          responsavel_email?: string
          responsavel_id?: string
          responsavel_nome?: string
          respostas?: Json
          status?: string
          subetapa_atual_id?: string
          subetapa_atual_nome?: string
          tipo_cor?: string
          tipo_id?: string
          tipo_nome?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      plano_comentarios: {
        Row: {
          autor_email: string
          autor_id: string
          autor_nome: string
          created_at: string
          id: string
          mensagem: string
          plano_id: string
        }
        Insert: {
          autor_email?: string
          autor_id?: string
          autor_nome?: string
          created_at?: string
          id?: string
          mensagem?: string
          plano_id: string
        }
        Update: {
          autor_email?: string
          autor_id?: string
          autor_nome?: string
          created_at?: string
          id?: string
          mensagem?: string
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_comentarios_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_de_acao"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_historico: {
        Row: {
          autor_email: string
          autor_id: string
          autor_nome: string
          campo: string
          created_at: string
          de: string
          id: string
          para: string
          plano_id: string
        }
        Insert: {
          autor_email?: string
          autor_id?: string
          autor_nome?: string
          campo?: string
          created_at?: string
          de?: string
          id?: string
          para?: string
          plano_id: string
        }
        Update: {
          autor_email?: string
          autor_id?: string
          autor_nome?: string
          campo?: string
          created_at?: string
          de?: string
          id?: string
          para?: string
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_historico_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_de_acao"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_origens: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id: string
          nome: string
          ordem?: number
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      planos_de_acao: {
        Row: {
          anexos: Json
          checklist: Json
          codigo: string | null
          concluida_em: string | null
          created_at: string
          descricao: string
          detalhamento: string
          id: string
          origem: string
          origem_outros: string
          prazo: string | null
          prioridade: string
          progresso: number
          responsavel_email: string
          responsavel_id: string
          responsavel_nome: string
          seguidores: string[]
          seguidores_ids: string[]
          setor: string
          status: string
          tempo_segundos: number
          timer_inicio: string | null
          titulo: string
          updated_at: string
          vinculo_id: string
          vinculo_tipo: string
        }
        Insert: {
          anexos?: Json
          checklist?: Json
          codigo?: string | null
          concluida_em?: string | null
          created_at?: string
          descricao?: string
          detalhamento?: string
          id?: string
          origem?: string
          origem_outros?: string
          prazo?: string | null
          prioridade?: string
          progresso?: number
          responsavel_email?: string
          responsavel_id?: string
          responsavel_nome?: string
          seguidores?: string[]
          seguidores_ids?: string[]
          setor?: string
          status?: string
          tempo_segundos?: number
          timer_inicio?: string | null
          titulo: string
          updated_at?: string
          vinculo_id?: string
          vinculo_tipo?: string
        }
        Update: {
          anexos?: Json
          checklist?: Json
          codigo?: string | null
          concluida_em?: string | null
          created_at?: string
          descricao?: string
          detalhamento?: string
          id?: string
          origem?: string
          origem_outros?: string
          prazo?: string | null
          prioridade?: string
          progresso?: number
          responsavel_email?: string
          responsavel_id?: string
          responsavel_nome?: string
          seguidores?: string[]
          seguidores_ids?: string[]
          setor?: string
          status?: string
          tempo_segundos?: number
          timer_inicio?: string | null
          titulo?: string
          updated_at?: string
          vinculo_id?: string
          vinculo_tipo?: string
        }
        Relationships: []
      }
      politica_leituras: {
        Row: {
          created_at: string
          decisao: string
          id: string
          politica_id: string
          revisao_lida: number
          updated_at: string
          usuario_email: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          decisao?: string
          id?: string
          politica_id: string
          revisao_lida?: number
          updated_at?: string
          usuario_email: string
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          decisao?: string
          id?: string
          politica_id?: string
          revisao_lida?: number
          updated_at?: string
          usuario_email?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "politica_leituras_politica_id_fkey"
            columns: ["politica_id"]
            isOneToOne: false
            referencedRelation: "politicas"
            referencedColumns: ["id"]
          },
        ]
      }
      politica_sugestoes: {
        Row: {
          created_at: string
          id: string
          politica_id: string
          status: string
          sugestao: string
          updated_at: string
          usuario_email: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          politica_id: string
          status?: string
          sugestao: string
          updated_at?: string
          usuario_email: string
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          id?: string
          politica_id?: string
          status?: string
          sugestao?: string
          updated_at?: string
          usuario_email?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "politica_sugestoes_politica_id_fkey"
            columns: ["politica_id"]
            isOneToOne: false
            referencedRelation: "politicas"
            referencedColumns: ["id"]
          },
        ]
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
          revisao_lida: number
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
          revisao_lida?: number
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
          revisao_lida?: number
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
      projeto_grupos: {
        Row: {
          created_at: string
          grupo_id: string
          id: string
          pode_editar: boolean
          pode_ver: boolean
          projeto_id: string
        }
        Insert: {
          created_at?: string
          grupo_id: string
          id?: string
          pode_editar?: boolean
          pode_ver?: boolean
          projeto_id: string
        }
        Update: {
          created_at?: string
          grupo_id?: string
          id?: string
          pode_editar?: boolean
          pode_ver?: boolean
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_grupos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_acessos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_grupos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_estrategicos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos_estrategicos: {
        Row: {
          codigo: string
          created_at: string
          fim_previsto: string | null
          fim_real: string | null
          frentes: Json
          grupo_alvo: string
          id: string
          inicio: string | null
          kanban_colunas: Json
          nome: string
          objetivo: string
          prioridade: string
          responsavel_email: string
          responsavel_id: string
          responsavel_nome: string
          setor: string
          status: string
          swot: Json
          tipo: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          fim_previsto?: string | null
          fim_real?: string | null
          frentes?: Json
          grupo_alvo?: string
          id?: string
          inicio?: string | null
          kanban_colunas?: Json
          nome: string
          objetivo?: string
          prioridade?: string
          responsavel_email?: string
          responsavel_id?: string
          responsavel_nome?: string
          setor?: string
          status?: string
          swot?: Json
          tipo?: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          fim_previsto?: string | null
          fim_real?: string | null
          frentes?: Json
          grupo_alvo?: string
          id?: string
          inicio?: string | null
          kanban_colunas?: Json
          nome?: string
          objetivo?: string
          prioridade?: string
          responsavel_email?: string
          responsavel_id?: string
          responsavel_nome?: string
          setor?: string
          status?: string
          swot?: Json
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
      tipos_reuniao: {
        Row: {
          ativo: boolean
          created_at: string
          dia_previsto: number | null
          id: string
          nome: string
          participantes: Json
          periodicidade: string
          signatarios: Json
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_previsto?: number | null
          id?: string
          nome: string
          participantes?: Json
          periodicidade?: string
          signatarios?: Json
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_previsto?: number | null
          id?: string
          nome?: string
          participantes?: Json
          periodicidade?: string
          signatarios?: Json
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
      atualizar_ata: {
        Args: {
          ata_id: string
          data_reuniao: string
          email_caller: string
          texto?: string
          titulo: string
        }
        Returns: {
          created_at: string
          criado_por: string
          data_reuniao: string
          id: string
          origem: string
          status: string
          texto: string
          tipo_reuniao: string | null
          titulo: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "atas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      atualizar_tipo_reuniao: {
        Args: {
          dia_previsto: number
          email_caller: string
          id: string
          nome: string
          participantes?: Json
          periodicidade: string
          signatarios?: Json
        }
        Returns: {
          ativo: boolean
          created_at: string
          dia_previsto: number | null
          id: string
          nome: string
          participantes: Json
          periodicidade: string
          signatarios: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tipos_reuniao"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      criar_ata: {
        Args: {
          data_reuniao: string
          email_caller: string
          origem: string
          texto?: string
          tipo_reuniao: string
          titulo: string
        }
        Returns: {
          created_at: string
          criado_por: string
          data_reuniao: string
          id: string
          origem: string
          status: string
          texto: string
          tipo_reuniao: string | null
          titulo: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "atas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      criar_tipo_reuniao: {
        Args: {
          dia_previsto: number
          email_caller: string
          nome: string
          participantes?: Json
          periodicidade: string
          signatarios?: Json
        }
        Returns: {
          ativo: boolean
          created_at: string
          dia_previsto: number | null
          id: string
          nome: string
          participantes: Json
          periodicidade: string
          signatarios: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tipos_reuniao"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      eh_participante_do_tipo: {
        Args: { tipo_id: string; usuario_id: string }
        Returns: boolean
      }
      mudar_ativo_tipo_reuniao: {
        Args: { ativo?: boolean; email_caller: string; id: string }
        Returns: {
          ativo: boolean
          created_at: string
          dia_previsto: number | null
          id: string
          nome: string
          participantes: Json
          periodicidade: string
          signatarios: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tipos_reuniao"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mudar_status_acao: {
        Args: { acao_id: string; email_caller: string; novo_status: string }
        Returns: undefined
      }
      pode_criar_ata: {
        Args: { email_caller: string; origem: string; tipo_id: string }
        Returns: boolean
      }
      pode_editar_ata: {
        Args: { ata_id: string; email_caller: string }
        Returns: boolean
      }
      pode_gerenciar_tipos_reuniao: {
        Args: { email_caller: string }
        Returns: boolean
      }
      pop_recalcular_contadores: { Args: { alvo: string }; Returns: undefined }
      salvar_leitura_assistida: {
        Args: {
          acoes?: Json
          ata_id: string
          email_caller: string
          setores?: Json
        }
        Returns: undefined
      }
      setor_id_por_nome: { Args: { nome: string }; Returns: string }
      usuario_id_por_email: { Args: { email: string }; Returns: string }
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
