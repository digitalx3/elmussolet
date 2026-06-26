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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_translation_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_count: number
          error_message: string | null
          function_name: string
          id: string
          items_count: number
          metadata: Json | null
          provider: string | null
          scope: string | null
          source_language: string | null
          status: string
          success_count: number
          target_language: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_message?: string | null
          function_name: string
          id?: string
          items_count?: number
          metadata?: Json | null
          provider?: string | null
          scope?: string | null
          source_language?: string | null
          status: string
          success_count?: number
          target_language?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_message?: string | null
          function_name?: string
          id?: string
          items_count?: number
          metadata?: Json | null
          provider?: string | null
          scope?: string | null
          source_language?: string | null
          status?: string
          success_count?: number
          target_language?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          error: string | null
          file_path: string | null
          file_size_bytes: number | null
          finished_at: string | null
          id: string
          kind: string
          started_at: string
          status: string
          storage_json: Json | null
          tables_json: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          error?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          id?: string
          kind?: string
          started_at?: string
          status?: string
          storage_json?: Json | null
          tables_json?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          error?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          id?: string
          kind?: string
          started_at?: string
          status?: string
          storage_json?: Json | null
          tables_json?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      birth_lists: {
        Row: {
          baby_name: string | null
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          list_code: string
          notes: string | null
          password_hash: string
          status: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          baby_name?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          list_code: string
          notes?: string | null
          password_hash: string
          status?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          baby_name?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          list_code?: string
          notes?: string | null
          password_hash?: string
          status?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "birth_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_lists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "list_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_translations: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          language_code: string
          name: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          language_code: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          language_code?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_translations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      brands: {
        Row: {
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_translations: {
        Row: {
          category_id: string
          description: string | null
          id: string
          language: string
          name: string
        }
        Insert: {
          category_id: string
          description?: string | null
          id?: string
          language: string
          name: string
        }
        Update: {
          category_id?: string
          description?: string | null
          id?: string
          language?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_block_translations: {
        Row: {
          block_id: string
          content: string | null
          created_at: string
          cta_label: string | null
          language_code: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          block_id: string
          content?: string | null
          created_at?: string
          cta_label?: string | null
          language_code: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          block_id?: string
          content?: string | null
          created_at?: string
          cta_label?: string | null
          language_code?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_block_translations_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "cms_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_block_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      cms_blocks: {
        Row: {
          background_color: string | null
          background_gradient: string | null
          content_ca: string | null
          content_es: string | null
          created_at: string
          cta_label_ca: string | null
          cta_label_es: string | null
          cta_url: string | null
          custom_class: string | null
          icon: string | null
          id: string
          image_url: string | null
          image_url_2: string | null
          is_active: boolean
          kind: string
          menu_location: string
          menu_order: number
          slug: string
          sort_order: number
          subtitle_ca: string | null
          subtitle_es: string | null
          title_ca: string | null
          title_es: string | null
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          background_gradient?: string | null
          content_ca?: string | null
          content_es?: string | null
          created_at?: string
          cta_label_ca?: string | null
          cta_label_es?: string | null
          cta_url?: string | null
          custom_class?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          is_active?: boolean
          kind: string
          menu_location?: string
          menu_order?: number
          slug: string
          sort_order?: number
          subtitle_ca?: string | null
          subtitle_es?: string | null
          title_ca?: string | null
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          background_gradient?: string | null
          content_ca?: string | null
          content_es?: string | null
          created_at?: string
          cta_label_ca?: string | null
          cta_label_es?: string | null
          cta_url?: string | null
          custom_class?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          is_active?: boolean
          kind?: string
          menu_location?: string
          menu_order?: number
          slug?: string
          sort_order?: number
          subtitle_ca?: string | null
          subtitle_es?: string | null
          title_ca?: string | null
          title_es?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          language: string | null
          message: string
          name: string
          phone: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          language?: string | null
          message: string
          name: string
          phone?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          language?: string | null
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cookie_categories: {
        Row: {
          created_at: string
          description_ca: string
          description_es: string
          id: string
          is_enabled: boolean
          is_required: boolean
          key: string
          name_ca: string
          name_es: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ca?: string
          description_es?: string
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          key: string
          name_ca: string
          name_es: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ca?: string
          description_es?: string
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          key?: string
          name_ca?: string
          name_es?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cookie_consent_log: {
        Row: {
          anon_id: string
          consent: Json
          created_at: string
          id: string
          ip_hash: string
          policy_version: number
          source: string
          user_agent: string
          user_id: string | null
        }
        Insert: {
          anon_id: string
          consent: Json
          created_at?: string
          id?: string
          ip_hash?: string
          policy_version?: number
          source?: string
          user_agent?: string
          user_id?: string | null
        }
        Update: {
          anon_id?: string
          consent?: Json
          created_at?: string
          id?: string
          ip_hash?: string
          policy_version?: number
          source?: string
          user_agent?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cookie_settings: {
        Row: {
          banner_text_ca: string
          banner_text_es: string
          banner_text_short_ca: string
          banner_text_short_es: string
          created_at: string
          ga_enabled: boolean
          ga_measurement_id: string
          id: string
          maps_requires_consent: boolean
          policy_url: string
          policy_version: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          banner_text_ca?: string
          banner_text_es?: string
          banner_text_short_ca?: string
          banner_text_short_es?: string
          created_at?: string
          ga_enabled?: boolean
          ga_measurement_id?: string
          id?: string
          maps_requires_consent?: boolean
          policy_url?: string
          policy_version?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          banner_text_ca?: string
          banner_text_es?: string
          banner_text_short_ca?: string
          banner_text_short_es?: string
          created_at?: string
          ga_enabled?: boolean
          ga_measurement_id?: string
          id?: string
          maps_requires_consent?: boolean
          policy_url?: string
          policy_version?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      cookies_registry: {
        Row: {
          category_id: string
          created_at: string
          duration: string
          id: string
          name: string
          provider: string
          purpose_ca: string
          purpose_es: string
          requires_consent: boolean
          service: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          duration?: string
          id?: string
          name: string
          provider?: string
          purpose_ca?: string
          purpose_es?: string
          requires_consent?: boolean
          service?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          duration?: string
          id?: string
          name?: string
          provider?: string
          purpose_ca?: string
          purpose_es?: string
          requires_consent?: boolean
          service?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cookies_registry_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cookie_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          auth_user_id: string | null
          city: string | null
          company_name: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          nif: string | null
          phone: string | null
          postal_code: string | null
          preferred_language: string
          province: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          auth_user_id?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          nif?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string
          province?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          auth_user_id?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          nif?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string
          province?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      default_list_section_translations: {
        Row: {
          created_at: string
          id: string
          language: string
          name: string
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          language: string
          name: string
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          name?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "default_list_section_translations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "default_list_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      default_list_sections: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      hero_slide_translations: {
        Row: {
          badge_text: string | null
          button1_text: string | null
          button2_text: string | null
          created_at: string
          language_code: string
          slide_id: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          badge_text?: string | null
          button1_text?: string | null
          button2_text?: string | null
          created_at?: string
          language_code: string
          slide_id: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          badge_text?: string | null
          button1_text?: string | null
          button2_text?: string | null
          created_at?: string
          language_code?: string
          slide_id?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_slide_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "hero_slide_translations_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "hero_slides"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_slides: {
        Row: {
          background_image_url: string | null
          background_overlay: number
          badge_text_ca: string | null
          badge_text_es: string | null
          button1_text_ca: string | null
          button1_text_es: string | null
          button1_url: string | null
          button1_variant: string | null
          button2_text_ca: string | null
          button2_text_es: string | null
          button2_url: string | null
          button2_variant: string | null
          canvas_heights: Json
          created_at: string
          floating_images: Json
          id: string
          is_active: boolean
          layout: Json
          name: string
          sort_order: number
          subtitle_ca: string | null
          subtitle_es: string | null
          title_ca: string | null
          title_es: string | null
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          background_overlay?: number
          badge_text_ca?: string | null
          badge_text_es?: string | null
          button1_text_ca?: string | null
          button1_text_es?: string | null
          button1_url?: string | null
          button1_variant?: string | null
          button2_text_ca?: string | null
          button2_text_es?: string | null
          button2_url?: string | null
          button2_variant?: string | null
          canvas_heights?: Json
          created_at?: string
          floating_images?: Json
          id?: string
          is_active?: boolean
          layout?: Json
          name: string
          sort_order?: number
          subtitle_ca?: string | null
          subtitle_es?: string | null
          title_ca?: string | null
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          background_overlay?: number
          badge_text_ca?: string | null
          badge_text_es?: string | null
          button1_text_ca?: string | null
          button1_text_es?: string | null
          button1_url?: string | null
          button1_variant?: string | null
          button2_text_ca?: string | null
          button2_text_es?: string | null
          button2_url?: string | null
          button2_variant?: string | null
          canvas_heights?: Json
          created_at?: string
          floating_images?: Json
          id?: string
          is_active?: boolean
          layout?: Json
          name?: string
          sort_order?: number
          subtitle_ca?: string | null
          subtitle_es?: string | null
          title_ca?: string | null
          title_es?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          created_at: string
          is_default: boolean
          is_enabled: boolean
          name: string
          native_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_default?: boolean
          is_enabled?: boolean
          name: string
          native_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_default?: boolean
          is_enabled?: boolean
          name?: string
          native_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      list_items: {
        Row: {
          added_at: string
          id: string
          list_id: string
          priority: string | null
          product_id: string
          quantity_desired: number | null
          quantity_purchased: number | null
          section_id: string | null
          sort_order: number | null
          variant_id: string | null
        }
        Insert: {
          added_at?: string
          id?: string
          list_id: string
          priority?: string | null
          product_id: string
          quantity_desired?: number | null
          quantity_purchased?: number | null
          section_id?: string | null
          sort_order?: number | null
          variant_id?: string | null
        }
        Update: {
          added_at?: string
          id?: string
          list_id?: string
          priority?: string | null
          product_id?: string
          quantity_desired?: number | null
          quantity_purchased?: number | null
          section_id?: string | null
          sort_order?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "birth_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "list_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      list_owners: {
        Row: {
          customer_id: string | null
          email: string
          first_name: string
          id: string
          is_primary: boolean | null
          last_name: string
          list_id: string
          user_id: string | null
        }
        Insert: {
          customer_id?: string | null
          email: string
          first_name: string
          id?: string
          is_primary?: boolean | null
          last_name: string
          list_id: string
          user_id?: string | null
        }
        Update: {
          customer_id?: string | null
          email?: string
          first_name?: string
          id?: string
          is_primary?: boolean | null
          last_name?: string
          list_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_owners_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_owners_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "birth_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_section_translations: {
        Row: {
          created_at: string
          language_code: string
          name: string | null
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          language_code: string
          name?: string | null
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          language_code?: string
          name?: string | null
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_section_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "list_section_translations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "list_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      list_sections: {
        Row: {
          created_at: string
          id: string
          list_id: string
          name_ca: string
          name_es: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          name_ca: string
          name_es: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          name_ca?: string
          name_es?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_sections_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "birth_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_template_items: {
        Row: {
          id: string
          product_id: string
          quantity: number | null
          section_id: string | null
          sort_order: number | null
          template_id: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          product_id: string
          quantity?: number | null
          section_id?: string | null
          sort_order?: number | null
          template_id: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number | null
          section_id?: string | null
          sort_order?: number | null
          template_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_template_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_template_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "list_template_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "list_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_template_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      list_template_sections: {
        Row: {
          created_at: string
          id: string
          name_ca: string
          name_es: string | null
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_ca: string
          name_es?: string | null
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_ca?: string
          name_es?: string | null
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "list_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      list_template_translations: {
        Row: {
          description: string | null
          id: string
          language: string
          name: string
          template_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          language: string
          name: string
          template_id: string
        }
        Update: {
          description?: string | null
          id?: string
          language?: string
          name?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_template_translations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "list_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      list_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          slug?: string
        }
        Relationships: []
      }
      maintenance_settings: {
        Row: {
          allowed_ips: string[]
          emergency_token_expires_at: string | null
          emergency_token_hash: string | null
          emergency_token_single_use: boolean
          emergency_token_used_at: string | null
          enabled: boolean
          id: string
          message_ca: string
          message_es: string
          show_logo: boolean
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_ips?: string[]
          emergency_token_expires_at?: string | null
          emergency_token_hash?: string | null
          emergency_token_single_use?: boolean
          emergency_token_used_at?: string | null
          enabled?: boolean
          id?: string
          message_ca?: string
          message_es?: string
          show_logo?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_ips?: string[]
          emergency_token_expires_at?: string | null
          emergency_token_hash?: string | null
          emergency_token_single_use?: boolean
          emergency_token_used_at?: string | null
          enabled?: boolean
          id?: string
          message_ca?: string
          message_es?: string
          show_logo?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      order_deletion_audit: {
        Row: {
          created_at: string
          deleted_by: string | null
          deleted_by_email: string | null
          id: string
          items_snapshot: Json | null
          list_id: string | null
          list_items_affected: number
          order_id: string | null
          order_items_deleted: number
          order_number: string | null
          order_snapshot: Json | null
          order_status: string | null
          payment_status: string | null
          stock_movements_created: number
          total: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_by?: string | null
          deleted_by_email?: string | null
          id?: string
          items_snapshot?: Json | null
          list_id?: string | null
          list_items_affected?: number
          order_id?: string | null
          order_items_deleted?: number
          order_number?: string | null
          order_snapshot?: Json | null
          order_status?: string | null
          payment_status?: string | null
          stock_movements_created?: number
          total?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_by?: string | null
          deleted_by_email?: string | null
          id?: string
          items_snapshot?: Json | null
          list_id?: string | null
          list_items_affected?: number
          order_id?: string | null
          order_items_deleted?: number
          order_number?: string | null
          order_snapshot?: Json | null
          order_status?: string | null
          payment_status?: string | null
          stock_movements_created?: number
          total?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          base_unit_price: number | null
          id: string
          list_item_id: string | null
          order_id: string
          product_id: string
          quantity: number
          tax_amount: number | null
          tax_percentage: number | null
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          base_unit_price?: number | null
          id?: string
          list_item_id?: string | null
          order_id: string
          product_id: string
          quantity: number
          tax_amount?: number | null
          tax_percentage?: number | null
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          base_unit_price?: number | null
          id?: string
          list_item_id?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          tax_amount?: number | null
          tax_percentage?: number | null
          total_price?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_list_item_id_fkey"
            columns: ["list_item_id"]
            isOneToOne: false
            referencedRelation: "list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_email_templates: {
        Row: {
          body_html: string
          id: string
          language: string
          status_id: string
          subject: string
        }
        Insert: {
          body_html?: string
          id?: string
          language: string
          status_id: string
          subject?: string
        }
        Update: {
          body_html?: string
          id?: string
          language?: string
          status_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_email_templates_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_translations: {
        Row: {
          id: string
          language: string
          name: string
          status_id: string
        }
        Insert: {
          id?: string
          language: string
          name: string
          status_id: string
        }
        Update: {
          id?: string
          language?: string
          name?: string
          status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_translations_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_statuses: {
        Row: {
          color: string
          id: string
          is_active: boolean | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          color?: string
          id?: string
          is_active?: boolean | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          color?: string
          id?: string
          is_active?: boolean | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          delivery_method: string | null
          id: string
          list_id: string | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          status: string | null
          subtotal: number
          tax_amount: number | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_method?: string | null
          id?: string
          list_id?: string | null
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: string | null
          subtotal: number
          tax_amount?: number | null
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_method?: string | null
          id?: string
          list_id?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "birth_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          id: string
          image_url: string
          is_primary: boolean | null
          product_id: string
          sort_order: number | null
        }
        Insert: {
          alt_text?: string | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          product_id: string
          sort_order?: number | null
        }
        Update: {
          alt_text?: string | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_relations: {
        Row: {
          created_at: string
          position: number
          product_id: string
          related_product_id: string
        }
        Insert: {
          created_at?: string
          position?: number
          product_id: string
          related_product_id: string
        }
        Update: {
          created_at?: string
          position?: number
          product_id?: string
          related_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_relations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_relations_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          description: string
          id: string
          language: string
          name: string
          product_id: string
          short_description: string | null
        }
        Insert: {
          description: string
          id?: string
          language: string
          name: string
          product_id: string
          short_description?: string | null
        }
        Update: {
          description?: string
          id?: string
          language?: string
          name?: string
          product_id?: string
          short_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_translations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          id: string
          is_active: boolean | null
          price_modifier: number
          price_override: number | null
          product_id: string
          sku_suffix: string | null
          stock_quantity: number | null
          value: string
          variant_type_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          price_modifier?: number
          price_override?: number | null
          product_id: string
          sku_suffix?: string | null
          stock_quantity?: number | null
          value: string
          variant_type_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          price_modifier?: number
          price_override?: number | null
          product_id?: string
          sku_suffix?: string | null
          stock_quantity?: number | null
          value?: string
          variant_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_variant_type_id_fkey"
            columns: ["variant_type_id"]
            isOneToOne: false
            referencedRelation: "variant_types"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          base_price_with_tax: number | null
          brand_id: string | null
          category_id: string | null
          created_at: string
          featured_order: number | null
          has_variants: boolean | null
          id: string
          is_active: boolean | null
          is_featured: boolean
          sale_ends_at: string | null
          sale_price_type: string | null
          sale_starts_at: string | null
          sale_value: number | null
          sale_value_with_tax: number | null
          sku: string
          slug: string
          stock_quantity: number | null
          stock_status: string | null
          tax_rate_id: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          base_price: number
          base_price_with_tax?: number | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          featured_order?: number | null
          has_variants?: boolean | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean
          sale_ends_at?: string | null
          sale_price_type?: string | null
          sale_starts_at?: string | null
          sale_value?: number | null
          sale_value_with_tax?: number | null
          sku: string
          slug: string
          stock_quantity?: number | null
          stock_status?: string | null
          tax_rate_id?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          base_price?: number
          base_price_with_tax?: number | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          featured_order?: number | null
          has_variants?: boolean | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean
          sale_ends_at?: string | null
          sale_price_type?: string | null
          sale_starts_at?: string | null
          sale_value?: number | null
          sale_value_with_tax?: number | null
          sku?: string
          slug?: string
          stock_quantity?: number | null
          stock_status?: string | null
          tax_rate_id?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_name: string | null
          created_at: string
          deleted_at: string | null
          deleted_email: string | null
          full_name: string | null
          id: string
          nif: string | null
          phone: string | null
          postal_code: string | null
          preferred_language: string
          province: string | null
          role: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_email?: string | null
          full_name?: string | null
          id: string
          nif?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string
          province?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_email?: string | null
          full_name?: string | null
          id?: string
          nif?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string
          province?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          id: string
          max_weight_grams: number
          min_weight_grams: number
          price: number
          zone_id: string
        }
        Insert: {
          id?: string
          max_weight_grams: number
          min_weight_grams: number
          price: number
          zone_id: string
        }
        Update: {
          id?: string
          max_weight_grams?: number
          min_weight_grams?: number
          price?: number
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          id: string
          is_active: boolean | null
          name: string
          postal_code_pattern: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          name: string
          postal_code_pattern: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          name?: string
          postal_code_pattern?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      smtp_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recipient: string
          smtp_host: string | null
          subject: string
          success: boolean
          test_mode: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient: string
          smtp_host?: string | null
          subject: string
          success: boolean
          test_mode?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient?: string
          smtp_host?: string | null
          subject?: string
          success?: boolean
          test_mode?: boolean
        }
        Relationships: []
      }
      smtp_settings: {
        Row: {
          created_at: string
          from_email: string
          from_name: string
          host: string
          id: string
          is_active: boolean
          password: string
          port: number
          security: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          is_active?: boolean
          password?: string
          port?: number
          security?: string
          updated_at?: string
          username?: string
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          is_active?: boolean
          password?: string
          port?: number
          security?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      stock_depletion_notifications: {
        Row: {
          admin_emails: Json
          affected_lists: Json
          created_at: string
          depleted_products: Json
          emails_failed: number
          emails_sent: number
          error: string | null
          id: string
          order_id: string | null
          owner_emails: Json
          status: string
        }
        Insert: {
          admin_emails?: Json
          affected_lists?: Json
          created_at?: string
          depleted_products?: Json
          emails_failed?: number
          emails_sent?: number
          error?: string | null
          id?: string
          order_id?: string | null
          owner_emails?: Json
          status?: string
        }
        Update: {
          admin_emails?: Json
          affected_lists?: Json
          created_at?: string
          depleted_products?: Json
          emails_failed?: number
          emails_sent?: number
          error?: string | null
          id?: string
          order_id?: string | null
          owner_emails?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_depletion_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          actor: string | null
          created_at: string
          delta: number
          id: string
          list_item_id: string | null
          order_id: string | null
          order_item_id: string | null
          product_id: string
          reason: string
          variant_id: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          delta: number
          id?: string
          list_item_id?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id: string
          reason: string
          variant_id?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          delta?: number
          id?: string
          list_item_id?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id?: string
          reason?: string
          variant_id?: string | null
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          country_code: string
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          percentage: number
          region: string | null
        }
        Insert: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          percentage?: number
          region?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          percentage?: number
          region?: string | null
        }
        Relationships: []
      }
      ui_translations: {
        Row: {
          ai_generated: boolean
          created_at: string
          id: string
          key: string
          language_code: string
          updated_at: string
          value: string
        }
        Insert: {
          ai_generated?: boolean
          created_at?: string
          id?: string
          key: string
          language_code: string
          updated_at?: string
          value?: string
        }
        Update: {
          ai_generated?: boolean
          created_at?: string
          id?: string
          key?: string
          language_code?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "ui_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variant_type_translations: {
        Row: {
          id: string
          language: string
          name: string
          variant_type_id: string
        }
        Insert: {
          id?: string
          language: string
          name: string
          variant_type_id: string
        }
        Update: {
          id?: string
          language?: string
          name?: string
          variant_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_type_translations_variant_type_id_fkey"
            columns: ["variant_type_id"]
            isOneToOne: false
            referencedRelation: "variant_types"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_types: {
        Row: {
          id: string
          slug: string
        }
        Insert: {
          id?: string
          slug: string
        }
        Update: {
          id?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_order_item_stock_delta: {
        Args: {
          _delta: number
          _list_item_id: string
          _order_id?: string
          _order_item_id?: string
          _product_id: string
          _reason?: string
          _variant_id: string
        }
        Returns: undefined
      }
      get_list_block_summary: {
        Args: { _list_id: string }
        Returns: {
          delivered_qty: number
          list_item_id: string
          reserved_qty: number
        }[]
      }
      get_list_purchases: {
        Args: { _list_id: string }
        Returns: {
          buyer_full_name: string
          created_at: string
          list_item_id: string
          order_id: string
          order_number: string
          order_status: string
          payment_status: string
          quantity: number
        }[]
      }
      get_maintenance_settings_admin: {
        Args: never
        Returns: {
          allowed_ips: string[]
          emergency_token_expires_at: string | null
          emergency_token_hash: string | null
          emergency_token_single_use: boolean
          emergency_token_used_at: string | null
          enabled: boolean
          id: string
          message_ca: string
          message_es: string
          show_logo: boolean
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "maintenance_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_top_products: {
        Args: { _from: string; _limit?: number; _to: string }
        Returns: {
          product_id: string
          revenue: number
          slug: string
          units: number
        }[]
      }
      has_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_permissions_enforced: { Args: never; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      user_owns_list: {
        Args: { _list_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_permission:
        | "ai_features"
        | "manage_backups"
        | "manage_users"
        | "manage_cookies"
        | "manage_smtp"
        | "manage_translations"
      app_role: "super_admin" | "admin" | "customer"
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
  public: {
    Enums: {
      app_permission: [
        "ai_features",
        "manage_backups",
        "manage_users",
        "manage_cookies",
        "manage_smtp",
        "manage_translations",
      ],
      app_role: ["super_admin", "admin", "customer"],
    },
  },
} as const
