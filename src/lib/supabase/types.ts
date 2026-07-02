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
          path?: string
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
          electricity_estimate: number | null
          electricity_included: boolean | null
          electricity_type: string
          id: string
          landlord_id: string
          latitude: number
          lease_duration: string
          location: unknown
          longitude: number
          metadata: Json
          parking_count: number
          parking_estimate: number | null
          parking_included: boolean | null
          parking_type: string
          price: number
          property_type: string | null
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
          location?: unknown
          longitude: number
          metadata?: Json
          parking_count?: number
          parking_estimate?: number | null
          parking_included?: boolean | null
          parking_type: string
          price: number
          property_type?: string | null
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
          location?: unknown
          longitude?: number
          metadata?: Json
          parking_count?: number
          parking_estimate?: number | null
          parking_included?: boolean | null
          parking_type?: string
          price?: number
          property_type?: string | null
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
      auth_email_verification_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auth_password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          }
        ]
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
          created_at: string
          email: string
          email_verified_at: string | null
          id: string
          phone: string | null
          phone_verified: boolean
          role: string | null
          updated_at: string
          full_name: string | null
          avatar_url: string | null
          about: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_verified_at?: string | null
          id: string
          phone?: string | null
          phone_verified?: boolean
          role?: string | null
          updated_at?: string
          full_name?: string | null
          avatar_url?: string | null
          about?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_verified_at?: string | null
          id?: string
          phone?: string | null
          phone_verified?: boolean
          role?: string | null
          updated_at?: string
          full_name?: string | null
          avatar_url?: string | null
          about?: string | null
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
          application_id: string
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
          application_id: string
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
          application_id?: string
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
            foreignKeyName: "viewings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: true
            referencedRelation: "viewing_slots"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      start_call_session: {
        Args: { target_conversation_id: string }
        Returns: { result: string; session_id: string | null }[]
      }
      end_call_session: {
        Args: { target_session_id: string; action: string }
        Returns: { result: string; new_status: string | null }[]
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
      get_published_listings_in_bbox_with_query: {
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
          availability_date: string | null
          bathrooms: number
          bedrooms: number
          created_at: string | null
          id: string
          image_urls: string[] | null
          latitude: number
          landlord_id: string
          landlord_name: string | null
          landlord_avatar_url: string | null
          landlord_phone_verified: boolean
          longitude: number
          price: number
          property_type: string | null
          thumbnail_url: string | null
          title: string
        }[]
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
          electricity_estimate: number | null
          electricity_included: boolean | null
          electricity_type: string
          latitude: number
          lease_duration: string
          longitude: number
          metadata: Json
          parking_count: number
          parking_estimate: number | null
          parking_included: boolean | null
          parking_type: string
          price: number
          property_type: string
          security_fee_estimate: number | null
          title: string
          water_availability: string
          water_estimate: number | null
          water_included: boolean | null
          wifi_available: boolean | null
          wifi_estimate: number | null
          wifi_included: boolean | null
        }
        Returns: { listing_id: string | null; result: string }[]
      }
      delete_listing_checked: {
        Args: { target_listing_id: string }
        Returns: { listing_id: string | null; result: string }[]
      }
      duplicate_listing: {
        Args: { target_listing_id: string }
        Returns: { listing_id: string | null; result: string }[]
      }
      submit_application_atomic: {
        Args: {
          target_application_id: string
          target_listing_id: string
          full_name: string
          income: number
          employment_status: string
          move_in_date: string
          household_size: number
          document_metadata: Json
        }
        Returns: { application_id: string | null; result: string }[]
      }
      update_application_status_checked: {
        Args: {
          target_application_id: string
          target_status: Database["public"]["Enums"]["application_status"]
        }
        Returns: { application_id: string | null; result: string }[]
      }
      record_auth_login_failure: {
        Args: {
          target_email_hash: string
          lockout_threshold?: number
          lockout_seconds?: number
        }
        Returns: { email_hash: string; attempt_count: number; locked_until: string | null }[]
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
      call_status: "ringing" | "active" | "ended" | "declined" | "missed"
      conversation_type: "inquiry" | "application"
      document_type: "id" | "payslip"
      listing_status: "draft" | "published" | "archived"
      notification_type:
      | "new_application"
      | "new_message"
      | "viewing_proposed"
      | "viewing_booked"
      | "application_status_changed"
      | "incoming_call"
      viewing_status: "booked" | "cancelled" | "completed"
      viewing_mode: "in_person" | "video_call"
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
      call_status: ["ringing", "active", "ended", "declined", "missed"],
      conversation_type: ["inquiry", "application"],
      document_type: ["id", "payslip"],
      listing_status: ["draft", "published", "archived"],
      notification_type: [
        "new_application",
        "new_message",
        "viewing_proposed",
        "viewing_booked",
        "application_status_changed",
        "incoming_call",
      ],
      viewing_status: ["booked", "cancelled", "completed"],
      viewing_mode: ["in_person", "video_call"],
    },
  },
} as const
