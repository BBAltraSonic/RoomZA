export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      blog_post_media: {
        Row: {
          alt_text: string
          bucket: string
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["blog_media_kind"]
          path: string
          post_id: string
          public_url: string
        }
        Insert: {
          alt_text: string
          bucket?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["blog_media_kind"]
          path: string
          post_id: string
          public_url: string
        }
        Update: {
          alt_text?: string
          bucket?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["blog_media_kind"]
          path?: string
          post_id?: string
          public_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          body_markdown: string
          created_at: string
          excerpt: string
          id: string
          published_at: string | null
          slug: string | null
          status: Database["public"]["Enums"]["blog_post_status"]
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_markdown?: string
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["blog_post_status"]
          title?: string
          topic?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_markdown?: string
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["blog_post_status"]
          title?: string
          topic?: string
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
      consent_events: {
        Row: {
          consent_key: string
          created_at: string
          granted: boolean
          id: string
          source: string
          user_id: string
        }
        Insert: {
          consent_key: string
          created_at?: string
          granted: boolean
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          consent_key?: string
          created_at?: string
          granted?: boolean
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
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
      listing_accreditations: {
        Row: {
          listing_id: string
          nsfas_approved: boolean
          verified_at: string
          verified_by: string
        }
        Insert: {
          listing_id: string
          nsfas_approved?: boolean
          verified_at?: string
          verified_by: string
        }
        Update: {
          listing_id?: string
          nsfas_approved?: boolean
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_accreditations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
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
          first_reviewed_at: string | null
          id: string
          listing_id: string | null
          listing_image_id: string | null
          message_id: string | null
          priority: Database["public"]["Enums"]["moderation_priority"]
          reported_user_id: string | null
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["moderation_case_status"]
          target_context: Json
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: Database["public"]["Enums"]["moderation_category"]
          created_at?: string
          details: string
          first_reviewed_at?: string | null
          id?: string
          listing_id?: string | null
          listing_image_id?: string | null
          message_id?: string | null
          priority?: Database["public"]["Enums"]["moderation_priority"]
          reported_user_id?: string | null
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["moderation_case_status"]
          target_context?: Json
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["moderation_category"]
          created_at?: string
          details?: string
          first_reviewed_at?: string | null
          id?: string
          listing_id?: string | null
          listing_image_id?: string | null
          message_id?: string | null
          priority?: Database["public"]["Enums"]["moderation_priority"]
          reported_user_id?: string | null
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["moderation_case_status"]
          target_context?: Json
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
            foreignKeyName: "moderation_cases_listing_image_id_fkey"
            columns: ["listing_image_id"]
            isOneToOne: false
            referencedRelation: "listing_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
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
      notification_preferences: {
        Row: {
          application_updates: boolean
          created_at: string
          digest_frequency: string
          location_personalization: boolean
          marketing: boolean
          message_digest: boolean
          search_alerts: boolean
          updated_at: string
          user_id: string
          viewing_updates: boolean
        }
        Insert: {
          application_updates?: boolean
          created_at?: string
          digest_frequency?: string
          location_personalization?: boolean
          marketing?: boolean
          message_digest?: boolean
          search_alerts?: boolean
          updated_at?: string
          user_id: string
          viewing_updates?: boolean
        }
        Update: {
          application_updates?: boolean
          created_at?: string
          digest_frequency?: string
          location_personalization?: boolean
          marketing?: boolean
          message_digest?: boolean
          search_alerts?: boolean
          updated_at?: string
          user_id?: string
          viewing_updates?: boolean
        }
        Relationships: []
      }
      policy_acceptances: {
        Row: {
          accepted_at: string
          document_id: string
          id: string
          source: string
          user_id: string
          version_id: string
        }
        Insert: {
          accepted_at?: string
          document_id: string
          id?: string
          source?: string
          user_id: string
          version_id: string
        }
        Update: {
          accepted_at?: string
          document_id?: string
          id?: string
          source?: string
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "trust_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acceptances_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "trust_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          artifact_bucket: string | null
          artifact_expires_at: string | null
          artifact_path: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          details: string
          due_at: string
          error_code: string | null
          id: string
          request_type: string
          resolution_note: string | null
          retention_decision: Json
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          artifact_bucket?: string | null
          artifact_expires_at?: string | null
          artifact_path?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          details?: string
          due_at?: string
          error_code?: string | null
          id?: string
          request_type: string
          resolution_note?: string | null
          retention_decision?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          artifact_bucket?: string | null
          artifact_expires_at?: string | null
          artifact_path?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          details?: string
          due_at?: string
          error_code?: string | null
          id?: string
          request_type?: string
          resolution_note?: string | null
          retention_decision?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      transparency_snapshots: {
        Row: {
          created_at: string
          generated_by: string | null
          id: string
          metrics: Json
          minimum_group_size: number
          period_end: string
          period_start: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          generated_by?: string | null
          id?: string
          metrics?: Json
          minimum_group_size?: number
          period_end: string
          period_start: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          generated_by?: string | null
          id?: string
          metrics?: Json
          minimum_group_size?: number
          period_end?: string
          period_start?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      trust_document_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body_markdown: string
          change_summary: string
          counsel_reference: string | null
          created_at: string
          document_id: string
          drafted_by: string | null
          effective_at: string | null
          external_reviewer_name: string | null
          id: string
          is_legacy_import: boolean
          published_at: string | null
          published_by: string | null
          requires_reacceptance: boolean
          reviewed_at: string | null
          status: string
          supersedes_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body_markdown: string
          change_summary?: string
          counsel_reference?: string | null
          created_at?: string
          document_id: string
          drafted_by?: string | null
          effective_at?: string | null
          external_reviewer_name?: string | null
          id?: string
          is_legacy_import?: boolean
          published_at?: string | null
          published_by?: string | null
          requires_reacceptance?: boolean
          reviewed_at?: string | null
          status?: string
          supersedes_id?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body_markdown?: string
          change_summary?: string
          counsel_reference?: string | null
          created_at?: string
          document_id?: string
          drafted_by?: string | null
          effective_at?: string | null
          external_reviewer_name?: string | null
          id?: string
          is_legacy_import?: boolean
          published_at?: string | null
          published_by?: string | null
          requires_reacceptance?: boolean
          reviewed_at?: string | null
          status?: string
          supersedes_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "trust_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "trust_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_document_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "trust_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_documents: {
        Row: {
          category: string
          created_at: string
          current_version_id: string | null
          id: string
          slug: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          current_version_id?: string | null
          id?: string
          slug: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          current_version_id?: string | null
          id?: string
          slug?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_documents_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "trust_document_versions"
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
      verification_checks: {
        Row: {
          check_key: string
          created_at: string
          evidence_note: string | null
          expires_at: string | null
          id: string
          listing_id: string | null
          profile_id: string | null
          public_label: string | null
          reviewed_by: string | null
          revoked_at: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          check_key: string
          created_at?: string
          evidence_note?: string | null
          expires_at?: string | null
          id?: string
          listing_id?: string | null
          profile_id?: string | null
          public_label?: string | null
          reviewed_by?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          check_key?: string
          created_at?: string
          evidence_note?: string | null
          expires_at?: string | null
          id?: string
          listing_id?: string | null
          profile_id?: string | null
          public_label?: string | null
          reviewed_by?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_checks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_checks_profile_id_fkey"
            columns: ["profile_id"]
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
      admin_create_blog_draft: {
        Args: { actor: string; audit_request_id: string }
        Returns: string
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
      admin_delete_blog_post: {
        Args: { actor: string; audit_request_id: string; target_post: string }
        Returns: undefined
      }
      admin_publish_trust_version: {
        Args: {
          actor: string
          audit_request_id: string
          target_version: string
        }
        Returns: undefined
      }
      admin_retry_notification: {
        Args: { actor: string; audit_request_id: string; target_event: string }
        Returns: string
      }
      admin_revoke_user_sessions: {
        Args: { actor: string; audit_request_id: string; target_user: string }
        Returns: undefined
      }
      admin_rollback_trust_version: {
        Args: {
          actor: string
          audit_request_id: string
          require_reacceptance?: boolean
          source_version_id: string
        }
        Returns: string
      }
      admin_save_blog_post: {
        Args: {
          actor: string
          audit_request_id: string
          next_body_markdown: string
          next_excerpt: string
          next_slug: string
          next_title: string
          next_topic: string
          target_post: string
        }
        Returns: undefined
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
      admin_set_blog_post_status: {
        Args: {
          actor: string
          audit_request_id: string
          next_status: Database["public"]["Enums"]["blog_post_status"]
          target_post: string
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
      admin_set_nsfas_accreditation: {
        Args: {
          action_reason: string
          actor: string
          approved: boolean
          audit_request_id: string
          target_listing: string
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
      get_my_auth_sessions: {
        Args: never
        Returns: {
          created_at: string
          id: string
          ip: unknown
          is_current: boolean
          updated_at: string
          user_agent: string
        }[]
      }
      get_public_listing_trust_signals: {
        Args: { target_listing_ids: string[] }
        Returns: {
          expires_at: string
          listing_id: string
          public_label: string
          verified_at: string
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
              furnished: boolean
              id: string
              image_urls: string[]
              landlord_avatar_url: string
              landlord_id: string
              landlord_name: string
              landlord_phone_verified: boolean
              latitude: number
              listing_reviewed_at: string
              listing_type: Database["public"]["Enums"]["listing_type"]
              longitude: number
              nsfas_approved: boolean
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
      blog_media_kind: "cover" | "inline"
      blog_post_status: "draft" | "published"
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
      admin_level: ["owner", "admin"],
      application_status: [
        "submitted",
        "under_review",
        "shortlisted",
        "rejected",
        "approved",
        "withdrawn",
      ],
      blog_media_kind: ["cover", "inline"],
      blog_post_status: ["draft", "published"],
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
} as const
