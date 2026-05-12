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
      applications: {
        Row: {
          created_at: string
          employment_status: string
          full_name: string
          household_size: number
          id: string
          income: number
          listing_id: string
          move_in_date: string
          renter_id: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          employment_status: string
          full_name: string
          household_size?: number
          id?: string
          income: number
          listing_id: string
          move_in_date: string
          renter_id: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          employment_status?: string
          full_name?: string
          household_size?: number
          id?: string
          income?: number
          listing_id?: string
          move_in_date?: string
          renter_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          application_id: string | null
          created_at: string
          id: string
          landlord_id: string
          listing_id: string
          renter_id: string
          type: Database["public"]["Enums"]["conversation_type"]
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          id?: string
          landlord_id: string
          listing_id: string
          renter_id: string
          type: Database["public"]["Enums"]["conversation_type"]
        }
        Update: {
          application_id?: string | null
          created_at?: string
          id?: string
          landlord_id?: string
          listing_id?: string
          renter_id?: string
          type?: Database["public"]["Enums"]["conversation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "conversations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          application_id: string
          created_at: string
          file_url: string
          id: string
          type: Database["public"]["Enums"]["document_type"]
        }
        Insert: {
          application_id: string
          created_at?: string
          file_url: string
          id?: string
          type: Database["public"]["Enums"]["document_type"]
        }
        Update: {
          application_id?: string
          created_at?: string
          file_url?: string
          id?: string
          type?: Database["public"]["Enums"]["document_type"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          bucket: string
          created_at: string
          id: string
          listing_id: string
          path: string
          public_url: string
          sort_order: number
        }
        Insert: {
          bucket?: string
          created_at?: string
          id?: string
          listing_id: string
          path: string
          public_url: string
          sort_order?: number
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          listing_id?: string
          path?: string
          public_url?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string
          availability_date: string
          bathrooms: number
          bedrooms: number
          created_at: string
          description: string | null
          electricity_type: string
          id: string
          landlord_id: string
          latitude: number
          lease_duration: string
          location: unknown
          longitude: number
          metadata: Json
          parking_count: number
          parking_type: string
          price: number
          property_type: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
          water_availability: string
        }
        Insert: {
          address: string
          availability_date: string
          bathrooms: number
          bedrooms: number
          created_at?: string
          description?: string | null
          electricity_type: string
          id?: string
          landlord_id: string
          latitude: number
          lease_duration: string
          location?: unknown
          longitude: number
          metadata?: Json
          parking_count?: number
          parking_type: string
          price: number
          property_type?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
          water_availability: string
        }
        Update: {
          address?: string
          availability_date?: string
          bathrooms?: number
          bedrooms?: number
          created_at?: string
          description?: string | null
          electricity_type?: string
          id?: string
          landlord_id?: string
          latitude?: number
          lease_duration?: string
          location?: unknown
          longitude?: number
          metadata?: Json
          parking_count?: number
          parking_type?: string
          price?: number
          property_type?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
          water_availability?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          listing_id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          listing_id: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          created_at: string
          digest_at: string | null
          id: string
          payload: Json
          recipient_id: string
          sent_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          created_at?: string
          digest_at?: string | null
          id?: string
          payload?: Json
          recipient_id: string
          sent_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          created_at?: string
          digest_at?: string | null
          id?: string
          payload?: Json
          recipient_id?: string
          sent_at?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          phone: string | null
          phone_verified: boolean
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          phone?: string | null
          phone_verified?: boolean
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          phone?: string | null
          phone_verified?: boolean
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      viewing_slot_offers: {
        Row: {
          application_id: string
          created_at: string
          id: string
          slot_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          slot_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_slot_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_slot_offers_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "viewing_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_slots: {
        Row: {
          created_at: string
          created_by: string
          end_time: string
          id: string
          is_booked: boolean
          listing_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_time: string
          id?: string
          is_booked?: boolean
          listing_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          is_booked?: boolean
          listing_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_slots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      viewings: {
        Row: {
          application_id: string
          created_at: string
          id: string
          slot_id: string
          status: Database["public"]["Enums"]["viewing_status"]
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          slot_id: string
          status?: Database["public"]["Enums"]["viewing_status"]
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          slot_id?: string
          status?: Database["public"]["Enums"]["viewing_status"]
        }
        Relationships: [
          {
            foreignKeyName: "viewings_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: true
            referencedRelation: "viewing_slots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_published_listings_in_bbox: {
        Args: { east: number; north: number; south: number; west: number }
        Returns: {
          address: string
          bathrooms: number
          bedrooms: number
          id: string
          latitude: number
          longitude: number
          price: number
          thumbnail_url: string
          title: string
        }[]
      }
      get_published_listings_in_bbox_with_query: {
        Args: { east: number; north: number; south: number; west: number; search_query?: string }
        Returns: {
          address: string
          bathrooms: number
          bedrooms: number
          id: string
          latitude: number
          longitude: number
          price: number
          thumbnail_url: string
          title: string
        }[]
      }
      book_viewing_slot_atomic: {
        Args: { target_application_id: string; target_slot_id: string }
        Returns: string
      }
      has_profile_role: { Args: { expected_role: string }; Returns: boolean }
    }
    Enums: {
      application_status:
      | "submitted"
      | "under_review"
      | "shortlisted"
      | "rejected"
      | "approved"
      | "withdrawn"
      conversation_type: "inquiry" | "application"
      document_type: "id" | "payslip"
      listing_status: "draft" | "published" | "archived"
      notification_type:
      | "new_application"
      | "new_message"
      | "viewing_proposed"
      | "viewing_booked"
      viewing_status: "booked" | "cancelled" | "completed"
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
      application_status: [
        "submitted",
        "under_review",
        "shortlisted",
        "rejected",
        "approved",
        "withdrawn",
      ],
      conversation_type: ["inquiry", "application"],
      document_type: ["id", "payslip"],
      listing_status: ["draft", "published", "archived"],
      notification_type: [
        "new_application",
        "new_message",
        "viewing_proposed",
        "viewing_booked",
      ],
      viewing_status: ["booked", "cancelled", "completed"],
    },
  },
} as const
