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
      list_items: {
        Row: {
          added_at: string
          id: string
          list_id: string
          priority: string | null
          product_id: string
          quantity_desired: number | null
          quantity_purchased: number | null
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
          email: string
          first_name: string
          id: string
          is_primary: boolean | null
          last_name: string
          list_id: string
          user_id: string | null
        }
        Insert: {
          email: string
          first_name: string
          id?: string
          is_primary?: boolean | null
          last_name: string
          list_id: string
          user_id?: string | null
        }
        Update: {
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
      list_template_items: {
        Row: {
          id: string
          product_id: string
          quantity: number | null
          sort_order: number | null
          template_id: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          product_id: string
          quantity?: number | null
          sort_order?: number | null
          template_id: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number | null
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
      order_items: {
        Row: {
          id: string
          list_item_id: string | null
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          id?: string
          list_item_id?: string | null
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          id?: string
          list_item_id?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
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
      orders: {
        Row: {
          created_at: string
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
          user_id: string
        }
        Insert: {
          created_at?: string
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
          user_id: string
        }
        Update: {
          created_at?: string
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
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "birth_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          brand_id: string | null
          category_id: string | null
          created_at: string
          has_variants: boolean | null
          id: string
          is_active: boolean | null
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
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          has_variants?: boolean | null
          id?: string
          is_active?: boolean | null
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
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          has_variants?: boolean | null
          id?: string
          is_active?: boolean | null
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
          created_at: string
          full_name: string | null
          id: string
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
          created_at?: string
          full_name?: string | null
          id: string
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
          created_at?: string
          full_name?: string | null
          id?: string
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      user_owns_list: {
        Args: { _list_id: string; _user_id: string }
        Returns: boolean
      }
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
    Enums: {},
  },
} as const
