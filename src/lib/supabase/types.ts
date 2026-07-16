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
      account_suspensions: {
        Row: {
          id: string
          reason: string
          restored_at: string | null
          restored_by: string | null
          suspended_at: string
          suspended_by: string | null
          suspended_until: string | null
          user_id: string
        }
        Insert: {
          id?: string
          reason: string
          restored_at?: string | null
          restored_by?: string | null
          suspended_at?: string
          suspended_by?: string | null
          suspended_until?: string | null
          user_id: string
        }
        Update: {
          id?: string
          reason?: string
          restored_at?: string | null
          restored_by?: string | null
          suspended_at?: string
          suspended_by?: string | null
          suspended_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_events: {
        Row: {
          action_key: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          request_id: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action_key: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action_key?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_memberships: {
        Row: {
          created_at: string
          invited_by: string | null
          level: Database["public"]["Enums"]["admin_level"]
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          level: Database["public"]["Enums"]["admin_level"]
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          level?: Database["public"]["Enums"]["admin_level"]
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      application_status_events: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: string
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          to_status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "application_status_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
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
      auth_login_attempts: {
        Row: {
          attempt_count: number
          created_at: string
          email_hash: string
          last_failed_at: string | null
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          email_hash: string
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          email_hash?: string
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      buyer_interest_private_notes: {
        Row: {
          buyer_interest_id: string
          created_at: string
          notes: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          buyer_interest_id: string
          created_at?: string
          notes?: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          buyer_interest_id?: string
          created_at?: string
          notes?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_interest_private_notes_buyer_interest_id_fkey"
            columns: ["buyer_interest_id"]
            isOneToOne: true
            referencedRelation: "buyer_interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_interest_private_notes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_interests: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          listing_id: string
          seller_id: string
          status: Database["public"]["Enums"]["buyer_interest_status"]
          updated_at: string
          viewing_date: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          listing_id: string
          seller_id: string
          status?: Database["public"]["Enums"]["buyer_interest_status"]
          updated_at?: string
          viewing_date?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["buyer_interest_status"]
          updated_at?: string
          viewing_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_interests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_interests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_interests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          answered_at: string | null
          callee_id: string
          caller_id: string
          conversation_id: string
          created_at: string
          ended_at: string | null
          id: string
          join_url: string
          listing_id: string
          provider: string
          room_id: string
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
        }
        Insert: {
          answered_at?: string | null
          callee_id: string
          caller_id: string
          conversation_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          join_url: string
          listing_id: string
          provider?: string
          room_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Update: {
          answered_at?: string | null
          callee_id?: string
          caller_id?: string
          conversation_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          join_url?: string
          listing_id?: string
          provider?: string
          room_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
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
          bucket: string
          byte_size: number | null
          created_at: string
          file_url: string
          id: string
          mime_type: string | null
          path: string
          scan_status: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by: string | null
        }
        Insert: {
          application_id: string
          bucket?: string
          byte_size?: number | null
          created_at?: string
          file_url: string
          id?: string
          mime_type?: string | null
          path: string
          scan_status?: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by?: string | null
        }
        Update: {
          application_id?: string
          bucket?: string
          byte_size?: number | null
          created_at?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          path?: string
          scan_status?: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      listing_restrictions: {
        Row: {
          id: string
          listing_id: string
          reason: string
          restored_at: string | null
          restored_by: string | null
          restricted_at: string
          restricted_by: string | null
        }
        Insert: {
          id?: string
          listing_id: string
          reason: string
          restored_at?: string | null
          restored_by?: string | null
          restricted_at?: string
          restricted_by?: string | null
        }
        Update: {
          id?: string
          listing_id?: string
          reason?: string
          restored_at?: string | null
          restored_by?: string | null
          restricted_at?: string
          restricted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_restrictions_listing_id_fkey"
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
          electricity_estimate: number | null
          electricity_included: boolean | null
          electricity_type: string
          id: string
          landlord_id: string
          latitude: number
          lease_duration: string
          listing_type: Database["public"]["Enums"]["listing_type"]
          location: unknown
          longitude: number
          metadata: Json
          parking_count: number
          parking_estimate: number | null
          parking_included: boolean | null
          parking_type: string
          price: number
          property_type: string | null
          sale_price: number | null
          security_fee_estimate: number | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
          water_availability: string
          water_estimate: number | null
          water_included: boolean | null
          wifi_available: boolean | null
          wifi_estimate: number | null
          wifi_included: boolean | null
        }
        Insert: {
          address: string
          availability_date: string
          bathrooms: number
          bedrooms: number
          created_at?: string
          description?: string | null
          electricity_estimate?: number | null
          electricity_included?: boolean | null
          electricity_type: string
          id?: string
          landlord_id: string
          latitude: number
          lease_duration: string
          listing_type?: Database["public"]["Enums"]["listing_type"]
          location?: unknown
          longitude: number
          metadata?: Json
          parking_count?: number
          parking_estimate?: number | null
          parking_included?: boolean | null
          parking_type: string
          price: number
          property_type?: string | null
          sale_price?: number | null
          security_fee_estimate?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
          water_availability: string
          water_estimate?: number | null
          water_included?: boolean | null
          wifi_available?: boolean | null
          wifi_estimate?: number | null
          wifi_included?: boolean | null
        }
        Update: {
          address?: string
          availability_date?: string
          bathrooms?: number
          bedrooms?: number
          created_at?: string
          description?: string | null
          electricity_estimate?: number | null
          electricity_included?: boolean | null
          electricity_type?: string
          id?: string
          landlord_id?: string
          latitude?: number
          lease_duration?: string
          listing_type?: Database["public"]["Enums"]["listing_type"]
          location?: unknown
          longitude?: number
          metadata?: Json
          parking_count?: number
          parking_estimate?: number | null
          parking_included?: boolean | null
          parking_type?: string
          price?: number
          property_type?: string | null
          sale_price?: number | null
          security_fee_estimate?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
          water_availability?: string
          water_estimate?: number | null
          water_included?: boolean | null
          wifi_available?: boolean | null
          wifi_estimate?: number | null
          wifi_included?: boolean | null
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
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          listing_id: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          read_at?: string | null
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
      moderation_case_notes: {
        Row: {
          author_id: string | null
          body: string
          case_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          case_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          case_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_cases: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["moderation_category"]
          created_at: string
          details: string
          id: string
          listing_id: string | null
          priority: Database["public"]["Enums"]["moderation_priority"]
          reported_user_id: string | null
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["moderation_case_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: Database["public"]["Enums"]["moderation_category"]
          created_at?: string
          details: string
          id?: string
          listing_id?: string | null
          priority?: Database["public"]["Enums"]["moderation_priority"]
          reported_user_id?: string | null
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["moderation_case_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["moderation_category"]
          created_at?: string
          details?: string
          id?: string
          listing_id?: string | null
          priority?: Database["public"]["Enums"]["moderation_priority"]
          reported_user_id?: string | null
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["moderation_case_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          bounding_box_east: number
          bounding_box_north: number
          bounding_box_south: number
          bounding_box_west: number
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          bounding_box_east: number
          bounding_box_north: number
          bounding_box_south: number
          bounding_box_west: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          bounding_box_east?: number
          bounding_box_north?: number
          bounding_box_south?: number
          bounding_box_west?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          attempt_count: number
          created_at: string
          digest_at: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          locked_at: string | null
          next_attempt_at: string
          payload: Json
          recipient_id: string
          sent_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          digest_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          payload?: Json
          recipient_id: string
          sent_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          attempt_count?: number
          created_at?: string
          digest_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
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
          about: string | null
          avatar_url: string | null
          created_at: string
          email: string
          email_verified_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          phone_verified: boolean
          role: string | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          email_verified_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          phone_verified?: boolean
          role?: string | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          phone_verified?: boolean
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_progress: {
        Row: {
          completed_stages: Database["public"]["Enums"]["purchase_stage"][]
          current_stage: Database["public"]["Enums"]["purchase_stage"]
          id: string
          listing_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_stages?: Database["public"]["Enums"]["purchase_stage"][]
          current_stage?: Database["public"]["Enums"]["purchase_stage"]
          id?: string
          listing_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_stages?: Database["public"]["Enums"]["purchase_stage"][]
          current_stage?: Database["public"]["Enums"]["purchase_stage"]
          id?: string
          listing_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_progress_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_alerts: {
        Row: {
          bounding_box_east: number
          bounding_box_north: number
          bounding_box_south: number
          bounding_box_west: number
          created_at: string
          email: string
          filters: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          bounding_box_east: number
          bounding_box_north: number
          bounding_box_south: number
          bounding_box_west: number
          created_at?: string
          email: string
          filters?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          bounding_box_east?: number
          bounding_box_north?: number
          bounding_box_south?: number
          bounding_box_west?: number
          created_at?: string
          email?: string
          filters?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_access_grants: {
        Row: {
          admin_id: string
          case_id: string
          created_at: string
          expires_at: string
          id: string
          reason: string
          resource_id: string
          resource_type: string
          revoked_at: string | null
        }
        Insert: {
          admin_id: string
          case_id: string
          created_at?: string
          expires_at?: string
          id?: string
          reason: string
          resource_id: string
          resource_type: string
          revoked_at?: string | null
        }
        Update: {
          admin_id?: string
          case_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          reason?: string
          resource_id?: string
          resource_type?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensitive_access_grants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_slot_offers: {
        Row: {
          application_id: string | null
          buyer_interest_id: string | null
          created_at: string
          id: string
          slot_id: string
        }
        Insert: {
          application_id?: string | null
          buyer_interest_id?: string | null
          created_at?: string
          id?: string
          slot_id: string
        }
        Update: {
          application_id?: string | null
          buyer_interest_id?: string | null
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
            foreignKeyName: "viewing_slot_offers_buyer_interest_id_fkey"
            columns: ["buyer_interest_id"]
            isOneToOne: false
            referencedRelation: "buyer_interests"
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
          mode: Database["public"]["Enums"]["viewing_mode"]
          start_time: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_time: string
          id?: string
          is_booked?: boolean
          listing_id: string
          mode?: Database["public"]["Enums"]["viewing_mode"]
          start_time: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          is_booked?: boolean
          listing_id?: string
          mode?: Database["public"]["Enums"]["viewing_mode"]
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
          application_id: string | null
          buyer_interest_id: string | null
          created_at: string
          id: string
          meeting_ends_at: string | null
          meeting_join_url: string | null
          meeting_provider: string | null
          meeting_room_id: string | null
          meeting_starts_at: string | null
          slot_id: string
          status: Database["public"]["Enums"]["viewing_status"]
        }
        Insert: {
          application_id?: string | null
          buyer_interest_id?: string | null
          created_at?: string
          id?: string
          meeting_ends_at?: string | null
          meeting_join_url?: string | null
          meeting_provider?: string | null
          meeting_room_id?: string | null
          meeting_starts_at?: string | null
          slot_id: string
          status?: Database["public"]["Enums"]["viewing_status"]
        }
        Update: {
          application_id?: string | null
          buyer_interest_id?: string | null
          created_at?: string
          id?: string
          meeting_ends_at?: string | null
          meeting_join_url?: string | null
          meeting_provider?: string | null
          meeting_room_id?: string | null
          meeting_starts_at?: string | null
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
            foreignKeyName: "viewings_buyer_interest_id_fkey"
            columns: ["buyer_interest_id"]
            isOneToOne: false
            referencedRelation: "buyer_interests"
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
      admin_add_case_note: {
        Args: {
          actor: string
          audit_request_id: string
          note_body: string
          target_case: string
        }
        Returns: string
      }
      admin_bootstrap_owner: {
        Args: { audit_request_id: string; target_user: string }
        Returns: undefined
      }
      admin_create_sensitive_grant: {
        Args: {
          action_reason: string
          actor: string
          audit_request_id: string
          target_case: string
          target_resource: string
          target_resource_type: string
        }
        Returns: {
          expires_at: string
          id: string
        }[]
      }
      admin_retry_notification: {
        Args: { actor: string; audit_request_id: string; target_event: string }
        Returns: string
      }
      admin_set_account_restriction: {
        Args: {
          action_reason: string
          actor: string
          audit_request_id: string
          restore: boolean
          target_user: string
          until_at: string
        }
        Returns: undefined
      }
      admin_set_listing_restriction: {
        Args: {
          action_reason: string
          actor: string
          audit_request_id: string
          restore: boolean
          target_listing: string
        }
        Returns: undefined
      }
      admin_set_membership: {
        Args: {
          action_reason: string
          actor: string
          audit_request_id: string
          next_level: Database["public"]["Enums"]["admin_level"]
          revoke: boolean
          target_user: string
        }
        Returns: undefined
      }
      admin_update_case: {
        Args: {
          actor: string
          audit_request_id: string
          next_assignee: string
          next_priority: Database["public"]["Enums"]["moderation_priority"]
          next_resolution: string
          next_status: Database["public"]["Enums"]["moderation_case_status"]
          target_case: string
        }
        Returns: undefined
      }
      assert_admin_actor: {
        Args: { actor: string; owner_only?: boolean }
        Returns: undefined
      }
      book_buyer_viewing_slot_atomic: {
        Args: { target_buyer_interest_id: string; target_slot_id: string }
        Returns: string
      }
      book_viewing_slot_atomic: {
        Args: { target_application_id: string; target_slot_id: string }
        Returns: string
      }
      create_listing_checked: {
        Args: {
          address: string
          availability_date: string
          bathrooms: number
          bedrooms: number
          description: string
          electricity_estimate: number
          electricity_included: boolean
          electricity_type: string
          latitude: number
          lease_duration: string
          longitude: number
          metadata: Json
          parking_count: number
          parking_estimate: number
          parking_included: boolean
          parking_type: string
          price: number
          property_type: string
          security_fee_estimate: number
          title: string
          water_availability: string
          water_estimate: number
          water_included: boolean
          wifi_available: boolean
          wifi_estimate: number
          wifi_included: boolean
        }
        Returns: {
          listing_id: string
          result: string
        }[]
      }
      delete_listing_checked: {
        Args: { target_listing_id: string }
        Returns: {
          listing_id: string
          result: string
        }[]
      }
      duplicate_listing: {
        Args: { target_listing_id: string }
        Returns: {
          listing_id: string
          result: string
        }[]
      }
      end_call_session: {
        Args: { action: string; target_session_id: string }
        Returns: {
          new_status: string
          result: string
        }[]
      }
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
      get_published_listings_in_bbox_with_query:
        | {
            Args: {
              east: number
              max_price?: number
              min_baths?: number
              min_beds?: number
              min_price?: number
              north: number
              property_type_filter?: string
              search_query?: string
              south: number
              west: number
            }
            Returns: {
              address: string
              availability_date: string
              bathrooms: number
              bedrooms: number
              created_at: string
              id: string
              image_urls: string[]
              landlord_avatar_url: string
              landlord_id: string
              landlord_name: string
              landlord_phone_verified: boolean
              latitude: number
              longitude: number
              price: number
              property_type: string
              thumbnail_url: string
              title: string
            }[]
          }
        | {
            Args: {
              east: number
              listing_type_filter?: Database["public"]["Enums"]["listing_type"]
              max_price?: number
              min_baths?: number
              min_beds?: number
              min_price?: number
              north: number
              property_type_filter?: string
              search_query?: string
              south: number
              west: number
            }
            Returns: {
              address: string
              availability_date: string
              bathrooms: number
              bedrooms: number
              created_at: string
              display_price: number
              id: string
              image_urls: string[]
              landlord_avatar_url: string
              landlord_id: string
              landlord_name: string
              landlord_phone_verified: boolean
              latitude: number
              listing_type: Database["public"]["Enums"]["listing_type"]
              longitude: number
              parking_count: number
              price: number
              property_type: string
              sale_price: number
              thumbnail_url: string
              title: string
            }[]
          }
      has_profile_role: { Args: { expected_role: string }; Returns: boolean }
      is_current_account_active: { Args: never; Returns: boolean }
      is_listing_unrestricted: {
        Args: { target_listing_id: string }
        Returns: boolean
      }
      record_auth_login_failure: {
        Args: {
          lockout_seconds?: number
          lockout_threshold?: number
          target_email_hash: string
        }
        Returns: {
          attempt_count: number
          email_hash: string
          locked_until: string
        }[]
      }
      start_call_session: {
        Args: { target_conversation_id: string }
        Returns: {
          result: string
          session_id: string
        }[]
      }
      submit_application_atomic: {
        Args: {
          document_metadata: Json
          employment_status: string
          full_name: string
          household_size: number
          income: number
          move_in_date: string
          target_application_id: string
          target_listing_id: string
        }
        Returns: {
          application_id: string
          result: string
        }[]
      }
      update_application_status_checked: {
        Args: {
          target_application_id: string
          target_status: Database["public"]["Enums"]["application_status"]
        }
        Returns: {
          application_id: string
          result: string
        }[]
      }
    }
    Enums: {
      admin_level: "owner" | "admin"
      application_status:
        | "submitted"
        | "under_review"
        | "shortlisted"
        | "rejected"
        | "approved"
        | "withdrawn"
      buyer_interest_status:
        | "interested"
        | "negotiating"
        | "accepted"
        | "declined"
      call_status: "ringing" | "active" | "ended" | "declined" | "missed"
      conversation_type: "inquiry" | "application"
      document_type: "id" | "payslip"
      listing_status: "draft" | "published" | "archived"
      listing_type: "rent" | "sale"
      moderation_case_status: "open" | "in_review" | "resolved" | "dismissed"
      moderation_category:
        | "fraud_or_scam"
        | "misleading_listing"
        | "duplicate_or_spam"
        | "discrimination"
        | "harassment"
        | "safety"
        | "privacy"
        | "other"
      moderation_priority: "low" | "normal" | "high" | "urgent"
      notification_type:
        | "new_application"
        | "new_message"
        | "viewing_proposed"
        | "viewing_booked"
        | "application_status_changed"
        | "incoming_call"
        | "admin_alert"
        | "moderation_update"
      purchase_stage:
        | "property_saved"
        | "viewing_scheduled"
        | "viewing_completed"
        | "contacted_seller"
        | "negotiating"
        | "sale_agreed"
        | "purchase_complete"
      viewing_mode: "in_person" | "video_call"
      viewing_status: "booked" | "cancelled" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
      admin_level: ["owner", "admin"],
      application_status: [
        "submitted",
        "under_review",
        "shortlisted",
        "rejected",
        "approved",
        "withdrawn",
      ],
      buyer_interest_status: [
        "interested",
        "negotiating",
        "accepted",
        "declined",
      ],
      call_status: ["ringing", "active", "ended", "declined", "missed"],
      conversation_type: ["inquiry", "application"],
      document_type: ["id", "payslip"],
      listing_status: ["draft", "published", "archived"],
      listing_type: ["rent", "sale"],
      moderation_case_status: ["open", "in_review", "resolved", "dismissed"],
      moderation_category: [
        "fraud_or_scam",
        "misleading_listing",
        "duplicate_or_spam",
        "discrimination",
        "harassment",
        "safety",
        "privacy",
        "other",
      ],
      moderation_priority: ["low", "normal", "high", "urgent"],
      notification_type: [
        "new_application",
        "new_message",
        "viewing_proposed",
        "viewing_booked",
        "application_status_changed",
        "incoming_call",
        "admin_alert",
        "moderation_update",
      ],
      purchase_stage: [
        "property_saved",
        "viewing_scheduled",
        "viewing_completed",
        "contacted_seller",
        "negotiating",
        "sale_agreed",
        "purchase_complete",
      ],
      viewing_mode: ["in_person", "video_call"],
      viewing_status: ["booked", "cancelled", "completed"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
