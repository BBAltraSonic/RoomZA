export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      account_security_events: {
        Row: {
          device_label: string | null;
          event_key: string;
          id: string;
          ip_hash: string | null;
          is_suspicious: boolean;
          metadata: Json;
          occurred_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          device_label?: string | null;
          event_key: string;
          id?: string;
          ip_hash?: string | null;
          is_suspicious?: boolean;
          metadata?: Json;
          occurred_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          device_label?: string | null;
          event_key?: string;
          id?: string;
          ip_hash?: string | null;
          is_suspicious?: boolean;
          metadata?: Json;
          occurred_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_security_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      account_suspensions: {
        Row: {
          id: string;
          reason: string;
          restored_at: string | null;
          restored_by: string | null;
          suspended_at: string;
          suspended_by: string | null;
          suspended_until: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          reason: string;
          restored_at?: string | null;
          restored_by?: string | null;
          suspended_at?: string;
          suspended_by?: string | null;
          suspended_until?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          reason?: string;
          restored_at?: string | null;
          restored_by?: string | null;
          suspended_at?: string;
          suspended_by?: string | null;
          suspended_until?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      admin_audit_events: {
        Row: {
          action_key: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          reason: string | null;
          request_id: string | null;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          action_key: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
          request_id?: string | null;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action_key?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
          request_id?: string | null;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      admin_memberships: {
        Row: {
          created_at: string;
          invited_by: string | null;
          level: Database["public"]["Enums"]["admin_level"];
          revoked_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          invited_by?: string | null;
          level: Database["public"]["Enums"]["admin_level"];
          revoked_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          invited_by?: string | null;
          level?: Database["public"]["Enums"]["admin_level"];
          revoked_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          created_at: string;
          event_name: string;
          id: string;
          properties: Json;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_name: string;
          id?: string;
          properties?: Json;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_name?: string;
          id?: string;
          properties?: Json;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      app_feature_flags: {
        Row: {
          description: string;
          enabled: boolean;
          key: string;
          updated_at: string;
        };
        Insert: {
          description?: string;
          enabled?: boolean;
          key: string;
          updated_at?: string;
        };
        Update: {
          description?: string;
          enabled?: boolean;
          key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      application_status_events: {
        Row: {
          actor_id: string | null;
          application_id: string;
          created_at: string;
          from_status: Database["public"]["Enums"]["application_status"] | null;
          id: string;
          to_status: Database["public"]["Enums"]["application_status"];
        };
        Insert: {
          actor_id?: string | null;
          application_id: string;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["application_status"]
            | null;
          id?: string;
          to_status: Database["public"]["Enums"]["application_status"];
        };
        Update: {
          actor_id?: string | null;
          application_id?: string;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["application_status"]
            | null;
          id?: string;
          to_status?: Database["public"]["Enums"]["application_status"];
        };
        Relationships: [
          {
            foreignKeyName: "application_status_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_status_events_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          created_at: string;
          employment_status: string;
          full_name: string;
          household_size: number;
          id: string;
          income: number;
          listing_id: string;
          move_in_date: string;
          renter_id: string;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          employment_status: string;
          full_name: string;
          household_size?: number;
          id?: string;
          income: number;
          listing_id: string;
          move_in_date: string;
          renter_id: string;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          employment_status?: string;
          full_name?: string;
          household_size?: number;
          id?: string;
          income?: number;
          listing_id?: string;
          move_in_date?: string;
          renter_id?: string;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_renter_id_fkey";
            columns: ["renter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_login_attempts: {
        Row: {
          attempt_count: number;
          created_at: string;
          email_hash: string;
          last_failed_at: string | null;
          locked_until: string | null;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          created_at?: string;
          email_hash: string;
          last_failed_at?: string | null;
          locked_until?: string | null;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          email_hash?: string;
          last_failed_at?: string | null;
          locked_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      blog_post_media: {
        Row: {
          alt_text: string;
          bucket: string;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["blog_media_kind"];
          path: string;
          post_id: string;
          public_url: string;
        };
        Insert: {
          alt_text: string;
          bucket?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["blog_media_kind"];
          path: string;
          post_id: string;
          public_url: string;
        };
        Update: {
          alt_text?: string;
          bucket?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["blog_media_kind"];
          path?: string;
          post_id?: string;
          public_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blog_post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "blog_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      blog_posts: {
        Row: {
          author_id: string | null;
          body_markdown: string;
          created_at: string;
          excerpt: string;
          id: string;
          published_at: string | null;
          slug: string | null;
          status: Database["public"]["Enums"]["blog_post_status"];
          title: string;
          topic: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body_markdown?: string;
          created_at?: string;
          excerpt?: string;
          id?: string;
          published_at?: string | null;
          slug?: string | null;
          status?: Database["public"]["Enums"]["blog_post_status"];
          title?: string;
          topic?: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body_markdown?: string;
          created_at?: string;
          excerpt?: string;
          id?: string;
          published_at?: string | null;
          slug?: string | null;
          status?: Database["public"]["Enums"]["blog_post_status"];
          title?: string;
          topic?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      buyer_interest_private_notes: {
        Row: {
          buyer_interest_id: string;
          created_at: string;
          notes: string;
          seller_id: string;
          updated_at: string;
        };
        Insert: {
          buyer_interest_id: string;
          created_at?: string;
          notes?: string;
          seller_id: string;
          updated_at?: string;
        };
        Update: {
          buyer_interest_id?: string;
          created_at?: string;
          notes?: string;
          seller_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_interest_private_notes_buyer_interest_id_fkey";
            columns: ["buyer_interest_id"];
            isOneToOne: true;
            referencedRelation: "buyer_interests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_interest_private_notes_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      buyer_interests: {
        Row: {
          buyer_id: string;
          created_at: string;
          id: string;
          listing_id: string;
          seller_id: string;
          status: Database["public"]["Enums"]["buyer_interest_status"];
          updated_at: string;
          viewing_date: string | null;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          id?: string;
          listing_id: string;
          seller_id: string;
          status?: Database["public"]["Enums"]["buyer_interest_status"];
          updated_at?: string;
          viewing_date?: string | null;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          id?: string;
          listing_id?: string;
          seller_id?: string;
          status?: Database["public"]["Enums"]["buyer_interest_status"];
          updated_at?: string;
          viewing_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_interests_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_interests_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_interests_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      buyer_profile_details: {
        Row: {
          bond_status: string | null;
          buying_budget: number | null;
          buying_timeline: string | null;
          deposit_saved: number | null;
          mortgage_provider: string | null;
          preferred_suburbs: string[];
          profile_id: string;
          property_goals: string[];
          purchase_purpose: string | null;
          updated_at: string;
        };
        Insert: {
          bond_status?: string | null;
          buying_budget?: number | null;
          buying_timeline?: string | null;
          deposit_saved?: number | null;
          mortgage_provider?: string | null;
          preferred_suburbs?: string[];
          profile_id: string;
          property_goals?: string[];
          purchase_purpose?: string | null;
          updated_at?: string;
        };
        Update: {
          bond_status?: string | null;
          buying_budget?: number | null;
          buying_timeline?: string | null;
          deposit_saved?: number | null;
          mortgage_provider?: string | null;
          preferred_suburbs?: string[];
          profile_id?: string;
          property_goals?: string[];
          purchase_purpose?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_profile_details_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      call_sessions: {
        Row: {
          answered_at: string | null;
          callee_id: string;
          caller_id: string;
          conversation_id: string;
          created_at: string;
          ended_at: string | null;
          id: string;
          join_url: string;
          listing_id: string;
          media_mode: string;
          provider: string;
          room_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["call_status"];
        };
        Insert: {
          answered_at?: string | null;
          callee_id: string;
          caller_id: string;
          conversation_id: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          join_url: string;
          listing_id: string;
          media_mode?: string;
          provider?: string;
          room_id: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["call_status"];
        };
        Update: {
          answered_at?: string | null;
          callee_id?: string;
          caller_id?: string;
          conversation_id?: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          join_url?: string;
          listing_id?: string;
          media_mode?: string;
          provider?: string;
          room_id?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["call_status"];
        };
        Relationships: [
          {
            foreignKeyName: "call_sessions_callee_id_fkey";
            columns: ["callee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_sessions_caller_id_fkey";
            columns: ["caller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_sessions_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_sessions_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_events: {
        Row: {
          consent_key: string;
          created_at: string;
          granted: boolean;
          id: string;
          source: string;
          user_id: string;
        };
        Insert: {
          consent_key: string;
          created_at?: string;
          granted: boolean;
          id?: string;
          source?: string;
          user_id: string;
        };
        Update: {
          consent_key?: string;
          created_at?: string;
          granted?: boolean;
          id?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          application_id: string | null;
          created_at: string;
          id: string;
          landlord_id: string;
          listing_id: string;
          renter_id: string;
          type: Database["public"]["Enums"]["conversation_type"];
        };
        Insert: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          landlord_id: string;
          listing_id: string;
          renter_id: string;
          type: Database["public"]["Enums"]["conversation_type"];
        };
        Update: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          landlord_id?: string;
          listing_id?: string;
          renter_id?: string;
          type?: Database["public"]["Enums"]["conversation_type"];
        };
        Relationships: [
          {
            foreignKeyName: "conversations_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_renter_id_fkey";
            columns: ["renter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          application_id: string;
          bucket: string;
          byte_size: number | null;
          created_at: string;
          file_url: string;
          id: string;
          mime_type: string | null;
          path: string;
          scan_status: string;
          type: Database["public"]["Enums"]["document_type"];
          uploaded_by: string | null;
        };
        Insert: {
          application_id: string;
          bucket?: string;
          byte_size?: number | null;
          created_at?: string;
          file_url: string;
          id?: string;
          mime_type?: string | null;
          path: string;
          scan_status?: string;
          type: Database["public"]["Enums"]["document_type"];
          uploaded_by?: string | null;
        };
        Update: {
          application_id?: string;
          bucket?: string;
          byte_size?: number | null;
          created_at?: string;
          file_url?: string;
          id?: string;
          mime_type?: string | null;
          path?: string;
          scan_status?: string;
          type?: Database["public"]["Enums"]["document_type"];
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      landlord_profile_details: {
        Row: {
          business_hours: Json;
          business_name: string | null;
          company_logo_url: string | null;
          license_details: string | null;
          office_location: string | null;
          owner_type: string | null;
          portfolio_size: number | null;
          profile_id: string;
          updated_at: string;
          years_managing: number | null;
        };
        Insert: {
          business_hours?: Json;
          business_name?: string | null;
          company_logo_url?: string | null;
          license_details?: string | null;
          office_location?: string | null;
          owner_type?: string | null;
          portfolio_size?: number | null;
          profile_id: string;
          updated_at?: string;
          years_managing?: number | null;
        };
        Update: {
          business_hours?: Json;
          business_name?: string | null;
          company_logo_url?: string | null;
          license_details?: string | null;
          office_location?: string | null;
          owner_type?: string | null;
          portfolio_size?: number | null;
          profile_id?: string;
          updated_at?: string;
          years_managing?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "landlord_profile_details_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      landlord_trust_metrics: {
        Row: {
          calculated_at: string;
          landlord_id: string;
          median_first_response_seconds: number | null;
          reply_sample_size: number;
          window_ended_at: string;
          window_started_at: string;
        };
        Insert: {
          calculated_at?: string;
          landlord_id: string;
          median_first_response_seconds?: number | null;
          reply_sample_size?: number;
          window_ended_at: string;
          window_started_at: string;
        };
        Update: {
          calculated_at?: string;
          landlord_id?: string;
          median_first_response_seconds?: number | null;
          reply_sample_size?: number;
          window_ended_at?: string;
          window_started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "landlord_trust_metrics_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_accreditations: {
        Row: {
          listing_id: string;
          nsfas_approved: boolean;
          verified_at: string;
          verified_by: string;
        };
        Insert: {
          listing_id: string;
          nsfas_approved?: boolean;
          verified_at?: string;
          verified_by: string;
        };
        Update: {
          listing_id?: string;
          nsfas_approved?: boolean;
          verified_at?: string;
          verified_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_accreditations_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: true;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_external_refs: {
        Row: {
          created_at: string;
          id: string;
          listing_id: string;
          organization_id: string;
          provider: string;
          source_reference: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          listing_id: string;
          organization_id: string;
          provider: string;
          source_reference: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          listing_id?: string;
          organization_id?: string;
          provider?: string;
          source_reference?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_external_refs_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_external_refs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_images: {
        Row: {
          bucket: string;
          created_at: string;
          id: string;
          listing_id: string;
          path: string;
          public_url: string;
          sort_order: number;
        };
        Insert: {
          bucket?: string;
          created_at?: string;
          id?: string;
          listing_id: string;
          path: string;
          public_url: string;
          sort_order?: number;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          id?: string;
          listing_id?: string;
          path?: string;
          public_url?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_import_assets: {
        Row: {
          archive_size_bytes: number | null;
          created_at: string;
          height: number | null;
          id: string;
          is_cover: boolean;
          job_id: string;
          match_method: string | null;
          mime_type: string | null;
          organization_id: string;
          rejection_code: string | null;
          row_id: string | null;
          size_bytes: number | null;
          sort_order: number | null;
          source_name: string | null;
          source_url_hash: string | null;
          state: Database["public"]["Enums"]["listing_import_asset_state"];
          storage_path: string | null;
          updated_at: string;
          width: number | null;
        };
        Insert: {
          archive_size_bytes?: number | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_cover?: boolean;
          job_id: string;
          match_method?: string | null;
          mime_type?: string | null;
          organization_id: string;
          rejection_code?: string | null;
          row_id?: string | null;
          size_bytes?: number | null;
          sort_order?: number | null;
          source_name?: string | null;
          source_url_hash?: string | null;
          state?: Database["public"]["Enums"]["listing_import_asset_state"];
          storage_path?: string | null;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          archive_size_bytes?: number | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_cover?: boolean;
          job_id?: string;
          match_method?: string | null;
          mime_type?: string | null;
          organization_id?: string;
          rejection_code?: string | null;
          row_id?: string | null;
          size_bytes?: number | null;
          sort_order?: number | null;
          source_name?: string | null;
          source_url_hash?: string | null;
          state?: Database["public"]["Enums"]["listing_import_asset_state"];
          storage_path?: string | null;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_import_assets_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "listing_import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_assets_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_assets_row_id_fkey";
            columns: ["row_id"];
            isOneToOne: false;
            referencedRelation: "listing_import_rows";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_import_change_snapshots: {
        Row: {
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          id: string;
          job_id: string;
          listing_id: string;
          listing_updated_at_after: string | null;
          listing_updated_at_before: string | null;
          operation: string;
          organization_id: string;
          rollback_conflict_code: string | null;
          rolled_back_at: string | null;
          row_id: string | null;
        };
        Insert: {
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          id?: string;
          job_id: string;
          listing_id: string;
          listing_updated_at_after?: string | null;
          listing_updated_at_before?: string | null;
          operation: string;
          organization_id: string;
          rollback_conflict_code?: string | null;
          rolled_back_at?: string | null;
          row_id?: string | null;
        };
        Update: {
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          id?: string;
          job_id?: string;
          listing_id?: string;
          listing_updated_at_after?: string | null;
          listing_updated_at_before?: string | null;
          operation?: string;
          organization_id?: string;
          rollback_conflict_code?: string | null;
          rolled_back_at?: string | null;
          row_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_import_change_snapshots_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "listing_import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_change_snapshots_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_change_snapshots_row_id_fkey";
            columns: ["row_id"];
            isOneToOne: false;
            referencedRelation: "listing_import_rows";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_import_events: {
        Row: {
          actor_id: string | null;
          aggregate_counts: Json;
          created_at: string;
          cursor: number | null;
          event_type: string;
          id: number;
          job_id: string;
          organization_id: string;
          sanitized_detail: Json;
          stage: Database["public"]["Enums"]["listing_import_job_stage"] | null;
        };
        Insert: {
          actor_id?: string | null;
          aggregate_counts?: Json;
          created_at?: string;
          cursor?: number | null;
          event_type: string;
          id?: never;
          job_id: string;
          organization_id: string;
          sanitized_detail?: Json;
          stage?:
            | Database["public"]["Enums"]["listing_import_job_stage"]
            | null;
        };
        Update: {
          actor_id?: string | null;
          aggregate_counts?: Json;
          created_at?: string;
          cursor?: number | null;
          event_type?: string;
          id?: never;
          job_id?: string;
          organization_id?: string;
          sanitized_detail?: Json;
          stage?:
            | Database["public"]["Enums"]["listing_import_job_stage"]
            | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_import_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "listing_import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_import_geocode_cache: {
        Row: {
          address_fingerprint: string;
          confidence: number | null;
          confirmed_by: string | null;
          created_at: string;
          expires_at: string;
          latitude: number | null;
          longitude: number | null;
          organization_id: string;
          result_metadata: Json;
          updated_at: string;
        };
        Insert: {
          address_fingerprint: string;
          confidence?: number | null;
          confirmed_by?: string | null;
          created_at?: string;
          expires_at?: string;
          latitude?: number | null;
          longitude?: number | null;
          organization_id: string;
          result_metadata?: Json;
          updated_at?: string;
        };
        Update: {
          address_fingerprint?: string;
          confidence?: number | null;
          confirmed_by?: string | null;
          created_at?: string;
          expires_at?: string;
          latitude?: number | null;
          longitude?: number | null;
          organization_id?: string;
          result_metadata?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_import_geocode_cache_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_geocode_cache_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_import_issues: {
        Row: {
          code: string;
          created_at: string;
          details: Json;
          field: string | null;
          id: string;
          job_id: string;
          message: string;
          organization_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          row_id: string | null;
          severity: Database["public"]["Enums"]["listing_import_issue_severity"];
        };
        Insert: {
          code: string;
          created_at?: string;
          details?: Json;
          field?: string | null;
          id?: string;
          job_id: string;
          message: string;
          organization_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          row_id?: string | null;
          severity: Database["public"]["Enums"]["listing_import_issue_severity"];
        };
        Update: {
          code?: string;
          created_at?: string;
          details?: Json;
          field?: string | null;
          id?: string;
          job_id?: string;
          message?: string;
          organization_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          row_id?: string | null;
          severity?: Database["public"]["Enums"]["listing_import_issue_severity"];
        };
        Relationships: [
          {
            foreignKeyName: "listing_import_issues_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "listing_import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_issues_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_issues_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_issues_row_id_fkey";
            columns: ["row_id"];
            isOneToOne: false;
            referencedRelation: "listing_import_rows";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_import_jobs: {
        Row: {
          adapter_version: string;
          blocked_rows: number;
          cancel_requested_at: string | null;
          cancelled_at: string | null;
          committed_rows: number;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          defaults: Json;
          failed_rows: number;
          heartbeat_at: string | null;
          id: string;
          last_progress_at: string | null;
          mapping: Json;
          message_code: string | null;
          message_detail: string | null;
          organization_id: string;
          processed_rows: number;
          record_path: string | null;
          retention_audit_until: string;
          retention_source_until: string;
          selection: Json;
          sheet_name: string | null;
          source_kind: Database["public"]["Enums"]["listing_import_source_kind"];
          source_metadata: Json;
          source_name: string | null;
          source_path: string | null;
          source_size_bytes: number | null;
          stage: Database["public"]["Enums"]["listing_import_job_stage"];
          stage_cursor: number;
          total_rows: number;
          updated_at: string;
          valid_rows: number;
          version: number;
          warning_rows: number;
        };
        Insert: {
          adapter_version?: string;
          blocked_rows?: number;
          cancel_requested_at?: string | null;
          cancelled_at?: string | null;
          committed_rows?: number;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          defaults?: Json;
          failed_rows?: number;
          heartbeat_at?: string | null;
          id?: string;
          last_progress_at?: string | null;
          mapping?: Json;
          message_code?: string | null;
          message_detail?: string | null;
          organization_id: string;
          processed_rows?: number;
          record_path?: string | null;
          retention_audit_until?: string;
          retention_source_until?: string;
          selection?: Json;
          sheet_name?: string | null;
          source_kind: Database["public"]["Enums"]["listing_import_source_kind"];
          source_metadata?: Json;
          source_name?: string | null;
          source_path?: string | null;
          source_size_bytes?: number | null;
          stage?: Database["public"]["Enums"]["listing_import_job_stage"];
          stage_cursor?: number;
          total_rows?: number;
          updated_at?: string;
          valid_rows?: number;
          version?: number;
          warning_rows?: number;
        };
        Update: {
          adapter_version?: string;
          blocked_rows?: number;
          cancel_requested_at?: string | null;
          cancelled_at?: string | null;
          committed_rows?: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          defaults?: Json;
          failed_rows?: number;
          heartbeat_at?: string | null;
          id?: string;
          last_progress_at?: string | null;
          mapping?: Json;
          message_code?: string | null;
          message_detail?: string | null;
          organization_id?: string;
          processed_rows?: number;
          record_path?: string | null;
          retention_audit_until?: string;
          retention_source_until?: string;
          selection?: Json;
          sheet_name?: string | null;
          source_kind?: Database["public"]["Enums"]["listing_import_source_kind"];
          source_metadata?: Json;
          source_name?: string | null;
          source_path?: string | null;
          source_size_bytes?: number | null;
          stage?: Database["public"]["Enums"]["listing_import_job_stage"];
          stage_cursor?: number;
          total_rows?: number;
          updated_at?: string;
          valid_rows?: number;
          version?: number;
          warning_rows?: number;
        };
        Relationships: [
          {
            foreignKeyName: "listing_import_jobs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_import_rows: {
        Row: {
          address_fingerprint: string | null;
          created_at: string;
          duplicate_candidate_ids: string[];
          duplicate_listing_id: string | null;
          duplicate_strategy:
            | Database["public"]["Enums"]["listing_import_duplicate_strategy"]
            | null;
          id: string;
          job_id: string;
          normalized_data: Json;
          office_id: string | null;
          organization_id: string;
          processed_at: string | null;
          publication_selected: boolean;
          raw_data: Json;
          responsible_agent_id: string | null;
          resulting_listing_id: string | null;
          row_number: number;
          row_version: number;
          state: Database["public"]["Enums"]["listing_import_row_state"];
          unmapped_data: Json;
          updated_at: string;
        };
        Insert: {
          address_fingerprint?: string | null;
          created_at?: string;
          duplicate_candidate_ids?: string[];
          duplicate_listing_id?: string | null;
          duplicate_strategy?:
            | Database["public"]["Enums"]["listing_import_duplicate_strategy"]
            | null;
          id?: string;
          job_id: string;
          normalized_data?: Json;
          office_id?: string | null;
          organization_id: string;
          processed_at?: string | null;
          publication_selected?: boolean;
          raw_data?: Json;
          responsible_agent_id?: string | null;
          resulting_listing_id?: string | null;
          row_number: number;
          row_version?: number;
          state?: Database["public"]["Enums"]["listing_import_row_state"];
          unmapped_data?: Json;
          updated_at?: string;
        };
        Update: {
          address_fingerprint?: string | null;
          created_at?: string;
          duplicate_candidate_ids?: string[];
          duplicate_listing_id?: string | null;
          duplicate_strategy?:
            | Database["public"]["Enums"]["listing_import_duplicate_strategy"]
            | null;
          id?: string;
          job_id?: string;
          normalized_data?: Json;
          office_id?: string | null;
          organization_id?: string;
          processed_at?: string | null;
          publication_selected?: boolean;
          raw_data?: Json;
          responsible_agent_id?: string | null;
          resulting_listing_id?: string | null;
          row_number?: number;
          row_version?: number;
          state?: Database["public"]["Enums"]["listing_import_row_state"];
          unmapped_data?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_import_rows_duplicate_listing_id_fkey";
            columns: ["duplicate_listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_rows_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "listing_import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_rows_office_id_fkey";
            columns: ["office_id"];
            isOneToOne: false;
            referencedRelation: "organization_offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_rows_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_rows_responsible_agent_id_fkey";
            columns: ["responsible_agent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_rows_resulting_listing_id_fkey";
            columns: ["resulting_listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_import_templates: {
        Row: {
          adapter_version: string;
          created_at: string;
          created_by: string;
          default_agent_id: string | null;
          default_office_id: string | null;
          defaults: Json;
          enum_dictionaries: Json;
          id: string;
          mapping: Json;
          name: string;
          organization_id: string;
          publish_preselected: boolean;
          source_kind: Database["public"]["Enums"]["listing_import_source_kind"];
          updated_at: string;
        };
        Insert: {
          adapter_version: string;
          created_at?: string;
          created_by: string;
          default_agent_id?: string | null;
          default_office_id?: string | null;
          defaults?: Json;
          enum_dictionaries?: Json;
          id?: string;
          mapping?: Json;
          name: string;
          organization_id: string;
          publish_preselected?: boolean;
          source_kind: Database["public"]["Enums"]["listing_import_source_kind"];
          updated_at?: string;
        };
        Update: {
          adapter_version?: string;
          created_at?: string;
          created_by?: string;
          default_agent_id?: string | null;
          default_office_id?: string | null;
          defaults?: Json;
          enum_dictionaries?: Json;
          id?: string;
          mapping?: Json;
          name?: string;
          organization_id?: string;
          publish_preselected?: boolean;
          source_kind?: Database["public"]["Enums"]["listing_import_source_kind"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_import_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_templates_default_agent_id_fkey";
            columns: ["default_agent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_templates_default_office_id_fkey";
            columns: ["default_office_id"];
            isOneToOne: false;
            referencedRelation: "organization_offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_import_templates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_restrictions: {
        Row: {
          id: string;
          listing_id: string;
          reason: string;
          restored_at: string | null;
          restored_by: string | null;
          restricted_at: string;
          restricted_by: string | null;
        };
        Insert: {
          id?: string;
          listing_id: string;
          reason: string;
          restored_at?: string | null;
          restored_by?: string | null;
          restricted_at?: string;
          restricted_by?: string | null;
        };
        Update: {
          id?: string;
          listing_id?: string;
          reason?: string;
          restored_at?: string | null;
          restored_by?: string | null;
          restricted_at?: string;
          restricted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_restrictions_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listings: {
        Row: {
          address: string;
          address_fingerprint: string | null;
          availability_date: string | null;
          bathrooms: number | null;
          bedrooms: number | null;
          created_at: string;
          description: string | null;
          electricity_estimate: number | null;
          electricity_included: boolean | null;
          electricity_type: string | null;
          id: string;
          is_featured: boolean;
          landlord_id: string;
          latitude: number | null;
          lease_duration: string | null;
          listing_type: Database["public"]["Enums"]["listing_type"];
          location: unknown;
          longitude: number | null;
          metadata: Json;
          organization_id: string | null;
          parking_count: number | null;
          parking_estimate: number | null;
          parking_included: boolean | null;
          parking_type: string | null;
          price: number;
          property_type: string | null;
          sale_price: number | null;
          security_fee_estimate: number | null;
          status: Database["public"]["Enums"]["listing_status"];
          title: string;
          updated_at: string;
          water_availability: string | null;
          water_estimate: number | null;
          water_included: boolean | null;
          wifi_available: boolean | null;
          wifi_estimate: number | null;
          wifi_included: boolean | null;
        };
        Insert: {
          address: string;
          address_fingerprint?: string | null;
          availability_date?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          created_at?: string;
          description?: string | null;
          electricity_estimate?: number | null;
          electricity_included?: boolean | null;
          electricity_type?: string | null;
          id?: string;
          is_featured?: boolean;
          landlord_id: string;
          latitude?: number | null;
          lease_duration?: string | null;
          listing_type?: Database["public"]["Enums"]["listing_type"];
          location?: unknown;
          longitude?: number | null;
          metadata?: Json;
          organization_id?: string | null;
          parking_count?: number | null;
          parking_estimate?: number | null;
          parking_included?: boolean | null;
          parking_type?: string | null;
          price: number;
          property_type?: string | null;
          sale_price?: number | null;
          security_fee_estimate?: number | null;
          status?: Database["public"]["Enums"]["listing_status"];
          title: string;
          updated_at?: string;
          water_availability?: string | null;
          water_estimate?: number | null;
          water_included?: boolean | null;
          wifi_available?: boolean | null;
          wifi_estimate?: number | null;
          wifi_included?: boolean | null;
        };
        Update: {
          address?: string;
          address_fingerprint?: string | null;
          availability_date?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          created_at?: string;
          description?: string | null;
          electricity_estimate?: number | null;
          electricity_included?: boolean | null;
          electricity_type?: string | null;
          id?: string;
          is_featured?: boolean;
          landlord_id?: string;
          latitude?: number | null;
          lease_duration?: string | null;
          listing_type?: Database["public"]["Enums"]["listing_type"];
          location?: unknown;
          longitude?: number | null;
          metadata?: Json;
          organization_id?: string | null;
          parking_count?: number | null;
          parking_estimate?: number | null;
          parking_included?: boolean | null;
          parking_type?: string | null;
          price?: number;
          property_type?: string | null;
          sale_price?: number | null;
          security_fee_estimate?: number | null;
          status?: Database["public"]["Enums"]["listing_status"];
          title?: string;
          updated_at?: string;
          water_availability?: string | null;
          water_estimate?: number | null;
          water_included?: boolean | null;
          wifi_available?: boolean | null;
          wifi_estimate?: number | null;
          wifi_included?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "listings_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      live_tour_recording_consents: {
        Row: {
          consented_at: string | null;
          granted: boolean;
          policy_version: string;
          revoked_at: string | null;
          tour_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          consented_at?: string | null;
          granted: boolean;
          policy_version?: string;
          revoked_at?: string | null;
          tour_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          consented_at?: string | null;
          granted?: boolean;
          policy_version?: string;
          revoked_at?: string | null;
          tour_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "live_tour_recording_consents_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "live_tours";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_tour_recording_consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      live_tours: {
        Row: {
          ended_at: string | null;
          host_id: string;
          id: string;
          join_url: string;
          listing_id: string;
          peak_viewers: number;
          provider: string;
          recording_ended_at: string | null;
          recording_error: string | null;
          recording_external_id: string | null;
          recording_retention_expires_at: string | null;
          recording_started_at: string | null;
          recording_status: Database["public"]["Enums"]["live_tour_recording_status"];
          recording_url: string | null;
          reminder_sent_at: string | null;
          room_id: string;
          scheduled_at: string | null;
          scheduled_duration_minutes: number;
          started_at: string | null;
          status: Database["public"]["Enums"]["live_tour_status"];
        };
        Insert: {
          ended_at?: string | null;
          host_id: string;
          id: string;
          join_url: string;
          listing_id: string;
          peak_viewers?: number;
          provider?: string;
          recording_ended_at?: string | null;
          recording_error?: string | null;
          recording_external_id?: string | null;
          recording_retention_expires_at?: string | null;
          recording_started_at?: string | null;
          recording_status?: Database["public"]["Enums"]["live_tour_recording_status"];
          recording_url?: string | null;
          reminder_sent_at?: string | null;
          room_id: string;
          scheduled_at?: string | null;
          scheduled_duration_minutes?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["live_tour_status"];
        };
        Update: {
          ended_at?: string | null;
          host_id?: string;
          id?: string;
          join_url?: string;
          listing_id?: string;
          peak_viewers?: number;
          provider?: string;
          recording_ended_at?: string | null;
          recording_error?: string | null;
          recording_external_id?: string | null;
          recording_retention_expires_at?: string | null;
          recording_started_at?: string | null;
          recording_status?: Database["public"]["Enums"]["live_tour_recording_status"];
          recording_url?: string | null;
          reminder_sent_at?: string | null;
          room_id?: string;
          scheduled_at?: string | null;
          scheduled_duration_minutes?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["live_tour_status"];
        };
        Relationships: [
          {
            foreignKeyName: "live_tours_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_tours_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          listing_id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          listing_id: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          listing_id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_case_notes: {
        Row: {
          author_id: string | null;
          body: string;
          case_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          case_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          case_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_case_notes_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "moderation_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_cases: {
        Row: {
          assigned_to: string | null;
          category: Database["public"]["Enums"]["moderation_category"];
          created_at: string;
          details: string;
          first_reviewed_at: string | null;
          id: string;
          listing_id: string | null;
          listing_image_id: string | null;
          message_id: string | null;
          priority: Database["public"]["Enums"]["moderation_priority"];
          reported_user_id: string | null;
          reporter_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["moderation_case_status"];
          target_context: Json;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          category: Database["public"]["Enums"]["moderation_category"];
          created_at?: string;
          details: string;
          first_reviewed_at?: string | null;
          id?: string;
          listing_id?: string | null;
          listing_image_id?: string | null;
          message_id?: string | null;
          priority?: Database["public"]["Enums"]["moderation_priority"];
          reported_user_id?: string | null;
          reporter_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["moderation_case_status"];
          target_context?: Json;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          category?: Database["public"]["Enums"]["moderation_category"];
          created_at?: string;
          details?: string;
          first_reviewed_at?: string | null;
          id?: string;
          listing_id?: string | null;
          listing_image_id?: string | null;
          message_id?: string | null;
          priority?: Database["public"]["Enums"]["moderation_priority"];
          reported_user_id?: string | null;
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["moderation_case_status"];
          target_context?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_cases_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_cases_listing_image_id_fkey";
            columns: ["listing_image_id"];
            isOneToOne: false;
            referencedRelation: "listing_images";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_cases_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_cases_reported_user_id_fkey";
            columns: ["reported_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_cases_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      neighborhoods: {
        Row: {
          bounding_box_east: number;
          bounding_box_north: number;
          bounding_box_south: number;
          bounding_box_west: number;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          bounding_box_east: number;
          bounding_box_north: number;
          bounding_box_south: number;
          bounding_box_west: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          bounding_box_east?: number;
          bounding_box_north?: number;
          bounding_box_south?: number;
          bounding_box_west?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_events: {
        Row: {
          attempt_count: number;
          created_at: string;
          digest_at: string | null;
          id: string;
          idempotency_key: string | null;
          last_error: string | null;
          locked_at: string | null;
          next_attempt_at: string;
          payload: Json;
          recipient_id: string;
          sent_at: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Insert: {
          attempt_count?: number;
          created_at?: string;
          digest_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          last_error?: string | null;
          locked_at?: string | null;
          next_attempt_at?: string;
          payload?: Json;
          recipient_id: string;
          sent_at?: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          digest_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          last_error?: string | null;
          locked_at?: string | null;
          next_attempt_at?: string;
          payload?: Json;
          recipient_id?: string;
          sent_at?: string | null;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notification_events_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          application_updates: boolean;
          created_at: string;
          digest_frequency: string;
          location_personalization: boolean;
          marketing: boolean;
          message_digest: boolean;
          search_alerts: boolean;
          updated_at: string;
          user_id: string;
          viewing_updates: boolean;
        };
        Insert: {
          application_updates?: boolean;
          created_at?: string;
          digest_frequency?: string;
          location_personalization?: boolean;
          marketing?: boolean;
          message_digest?: boolean;
          search_alerts?: boolean;
          updated_at?: string;
          user_id: string;
          viewing_updates?: boolean;
        };
        Update: {
          application_updates?: boolean;
          created_at?: string;
          digest_frequency?: string;
          location_personalization?: boolean;
          marketing?: boolean;
          message_digest?: boolean;
          search_alerts?: boolean;
          updated_at?: string;
          user_id?: string;
          viewing_updates?: boolean;
        };
        Relationships: [];
      };
      notification_subscriptions: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"];
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          enabled: boolean;
          frequency: Database["public"]["Enums"]["notification_frequency"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category: Database["public"]["Enums"]["notification_category"];
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          enabled?: boolean;
          frequency?: Database["public"]["Enums"]["notification_frequency"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["notification_category"];
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          enabled?: boolean;
          frequency?: Database["public"]["Enums"]["notification_frequency"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          office_id: string | null;
          organization_id: string;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["organization_role"];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          office_id?: string | null;
          organization_id: string;
          revoked_at?: string | null;
          role: Database["public"]["Enums"]["organization_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          office_id?: string | null;
          organization_id?: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["organization_role"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_office_id_fkey";
            columns: ["office_id"];
            isOneToOne: false;
            referencedRelation: "organization_offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_memberships: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string | null;
          joined_at: string;
          office_id: string | null;
          organization_id: string;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["organization_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          joined_at?: string;
          office_id?: string | null;
          organization_id: string;
          revoked_at?: string | null;
          role: Database["public"]["Enums"]["organization_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          joined_at?: string;
          office_id?: string | null;
          organization_id?: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["organization_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_memberships_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_memberships_office_id_fkey";
            columns: ["office_id"];
            isOneToOne: false;
            referencedRelation: "organization_offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_offices: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_default: boolean;
          name: string;
          organization_id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          organization_id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          organization_id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_offices_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          imports_pilot_enabled: boolean;
          name: string;
          owner_id: string;
          settings: Json;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          imports_pilot_enabled?: boolean;
          name: string;
          owner_id: string;
          settings?: Json;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          imports_pilot_enabled?: boolean;
          name?: string;
          owner_id?: string;
          settings?: Json;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      policy_acceptances: {
        Row: {
          accepted_at: string;
          document_id: string;
          id: string;
          source: string;
          user_id: string;
          version_id: string;
        };
        Insert: {
          accepted_at?: string;
          document_id: string;
          id?: string;
          source?: string;
          user_id: string;
          version_id: string;
        };
        Update: {
          accepted_at?: string;
          document_id?: string;
          id?: string;
          source?: string;
          user_id?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "policy_acceptances_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "trust_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policy_acceptances_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "trust_document_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      privacy_requests: {
        Row: {
          artifact_bucket: string | null;
          artifact_expires_at: string | null;
          artifact_path: string | null;
          assigned_to: string | null;
          completed_at: string | null;
          created_at: string;
          details: string;
          due_at: string;
          error_code: string | null;
          id: string;
          request_type: string;
          resolution_note: string | null;
          retention_decision: Json;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          artifact_bucket?: string | null;
          artifact_expires_at?: string | null;
          artifact_path?: string | null;
          assigned_to?: string | null;
          completed_at?: string | null;
          created_at?: string;
          details?: string;
          due_at?: string;
          error_code?: string | null;
          id?: string;
          request_type: string;
          resolution_note?: string | null;
          retention_decision?: Json;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          artifact_bucket?: string | null;
          artifact_expires_at?: string | null;
          artifact_path?: string | null;
          assigned_to?: string | null;
          completed_at?: string | null;
          created_at?: string;
          details?: string;
          due_at?: string;
          error_code?: string | null;
          id?: string;
          request_type?: string;
          resolution_note?: string | null;
          retention_decision?: Json;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      profile_activity_events: {
        Row: {
          category: string;
          created_at: string;
          event_key: string;
          id: string;
          occurred_at: string;
          profile_id: string;
          reference_id: string | null;
          reference_type: string | null;
          summary: string | null;
          title: string;
          visibility: Database["public"]["Enums"]["profile_activity_visibility"];
        };
        Insert: {
          category: string;
          created_at?: string;
          event_key: string;
          id?: string;
          occurred_at?: string;
          profile_id: string;
          reference_id?: string | null;
          reference_type?: string | null;
          summary?: string | null;
          title: string;
          visibility?: Database["public"]["Enums"]["profile_activity_visibility"];
        };
        Update: {
          category?: string;
          created_at?: string;
          event_key?: string;
          id?: string;
          occurred_at?: string;
          profile_id?: string;
          reference_id?: string | null;
          reference_type?: string | null;
          summary?: string | null;
          title?: string;
          visibility?: Database["public"]["Enums"]["profile_activity_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "profile_activity_events_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_contact_requests: {
        Row: {
          created_at: string;
          id: string;
          intent: string;
          listing_id: string | null;
          message: string;
          recipient_id: string;
          requester_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          intent: string;
          listing_id?: string | null;
          message: string;
          recipient_id: string;
          requester_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          intent?: string;
          listing_id?: string | null;
          message?: string;
          recipient_id?: string;
          requester_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_contact_requests_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_contact_requests_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_contact_requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_document_shares: {
        Row: {
          application_id: string | null;
          created_at: string;
          document_id: string;
          expires_at: string | null;
          grantee_id: string | null;
          id: string;
          owner_id: string;
          purpose: string;
          revoked_at: string | null;
          version_id: string;
        };
        Insert: {
          application_id?: string | null;
          created_at?: string;
          document_id: string;
          expires_at?: string | null;
          grantee_id?: string | null;
          id?: string;
          owner_id: string;
          purpose?: string;
          revoked_at?: string | null;
          version_id: string;
        };
        Update: {
          application_id?: string | null;
          created_at?: string;
          document_id?: string;
          expires_at?: string | null;
          grantee_id?: string | null;
          id?: string;
          owner_id?: string;
          purpose?: string;
          revoked_at?: string | null;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_document_shares_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_document_shares_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "profile_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_document_shares_grantee_id_fkey";
            columns: ["grantee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_document_shares_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_document_shares_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "profile_document_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_document_versions: {
        Row: {
          bucket: string;
          checksum_sha256: string;
          created_at: string;
          document_id: string;
          id: string;
          mime_type: string;
          owner_id: string;
          path: string;
          size_bytes: number;
          version: number;
        };
        Insert: {
          bucket: string;
          checksum_sha256: string;
          created_at?: string;
          document_id: string;
          id?: string;
          mime_type: string;
          owner_id: string;
          path: string;
          size_bytes: number;
          version: number;
        };
        Update: {
          bucket?: string;
          checksum_sha256?: string;
          created_at?: string;
          document_id?: string;
          id?: string;
          mime_type?: string;
          owner_id?: string;
          path?: string;
          size_bytes?: number;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profile_document_versions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "profile_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_document_versions_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_documents: {
        Row: {
          created_at: string;
          current_version_id: string | null;
          deleted_at: string | null;
          display_name: string;
          document_type: string;
          expires_at: string | null;
          id: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_version_id?: string | null;
          deleted_at?: string | null;
          display_name: string;
          document_type: string;
          expires_at?: string | null;
          id?: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_version_id?: string | null;
          deleted_at?: string | null;
          display_name?: string;
          document_type?: string;
          expires_at?: string | null;
          id?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_documents_current_version_fkey";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "profile_document_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_mutes: {
        Row: {
          created_at: string;
          muted_id: string;
          muter_id: string;
        };
        Insert: {
          created_at?: string;
          muted_id: string;
          muter_id: string;
        };
        Update: {
          created_at?: string;
          muted_id?: string;
          muter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_mutes_muted_id_fkey";
            columns: ["muted_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_mutes_muter_id_fkey";
            columns: ["muter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_personas: {
        Row: {
          created_at: string;
          is_active: boolean;
          is_primary: boolean;
          persona: Database["public"]["Enums"]["marketplace_persona"];
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          is_primary?: boolean;
          persona: Database["public"]["Enums"]["marketplace_persona"];
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          is_primary?: boolean;
          persona?: Database["public"]["Enums"]["marketplace_persona"];
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_personas_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_review_entitlements: {
        Row: {
          available_at: string;
          closes_at: string;
          created_at: string;
          id: string;
          interaction_id: string;
          interaction_type: string;
          reviewer_id: string;
          subject_id: string;
        };
        Insert: {
          available_at?: string;
          closes_at?: string;
          created_at?: string;
          id?: string;
          interaction_id: string;
          interaction_type: string;
          reviewer_id: string;
          subject_id: string;
        };
        Update: {
          available_at?: string;
          closes_at?: string;
          created_at?: string;
          id?: string;
          interaction_id?: string;
          interaction_type?: string;
          reviewer_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_review_entitlements_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_review_entitlements_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_review_helpful_votes: {
        Row: {
          created_at: string;
          review_id: string;
          voter_id: string;
        };
        Insert: {
          created_at?: string;
          review_id: string;
          voter_id: string;
        };
        Update: {
          created_at?: string;
          review_id?: string;
          voter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_review_helpful_votes_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "profile_reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_review_helpful_votes_voter_id_fkey";
            columns: ["voter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_review_reports: {
        Row: {
          category: string;
          created_at: string;
          details: string;
          id: string;
          reporter_id: string;
          review_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          details: string;
          id?: string;
          reporter_id: string;
          review_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          details?: string;
          id?: string;
          reporter_id?: string;
          review_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_review_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_review_reports_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "profile_reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_reviews: {
        Row: {
          body: string;
          communication: number | null;
          created_at: string;
          entitlement_id: string;
          honesty: number | null;
          id: string;
          moderated_at: string | null;
          moderation_reason: string | null;
          overall: number;
          professionalism: number | null;
          property_accuracy: number | null;
          publish_after: string | null;
          published_at: string | null;
          responsiveness: number | null;
          reviewer_id: string;
          status: Database["public"]["Enums"]["profile_review_status"];
          subject_id: string;
          submitted_at: string | null;
          updated_at: string;
          viewing_experience: number | null;
        };
        Insert: {
          body?: string;
          communication?: number | null;
          created_at?: string;
          entitlement_id: string;
          honesty?: number | null;
          id?: string;
          moderated_at?: string | null;
          moderation_reason?: string | null;
          overall: number;
          professionalism?: number | null;
          property_accuracy?: number | null;
          publish_after?: string | null;
          published_at?: string | null;
          responsiveness?: number | null;
          reviewer_id: string;
          status?: Database["public"]["Enums"]["profile_review_status"];
          subject_id: string;
          submitted_at?: string | null;
          updated_at?: string;
          viewing_experience?: number | null;
        };
        Update: {
          body?: string;
          communication?: number | null;
          created_at?: string;
          entitlement_id?: string;
          honesty?: number | null;
          id?: string;
          moderated_at?: string | null;
          moderation_reason?: string | null;
          overall?: number;
          professionalism?: number | null;
          property_accuracy?: number | null;
          publish_after?: string | null;
          published_at?: string | null;
          responsiveness?: number | null;
          reviewer_id?: string;
          status?: Database["public"]["Enums"]["profile_review_status"];
          subject_id?: string;
          submitted_at?: string | null;
          updated_at?: string;
          viewing_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "profile_reviews_entitlement_id_fkey";
            columns: ["entitlement_id"];
            isOneToOne: true;
            referencedRelation: "profile_review_entitlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_reviews_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_sync_events: {
        Row: {
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          profile_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: never;
          profile_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          profile_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profile_sync_events_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_versions: {
        Row: {
          changed_fields: string[];
          created_at: string;
          created_by: string | null;
          id: string;
          persona_snapshot: Json;
          profile_id: string;
          public_snapshot: Json;
          version: number;
        };
        Insert: {
          changed_fields?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          persona_snapshot?: Json;
          profile_id: string;
          public_snapshot?: Json;
          version: number;
        };
        Update: {
          changed_fields?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          persona_snapshot?: Json;
          profile_id?: string;
          public_snapshot?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profile_versions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          about: string | null;
          active_organization_id: string | null;
          availability_mode: string;
          avatar_url: string | null;
          created_at: string;
          email: string;
          email_verified_at: string | null;
          full_name: string | null;
          id: string;
          last_seen_at: string | null;
          phone: string | null;
          phone_verified: boolean;
          presence_status: string;
          role: string | null;
          updated_at: string;
        };
        Insert: {
          about?: string | null;
          active_organization_id?: string | null;
          availability_mode?: string;
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          email_verified_at?: string | null;
          full_name?: string | null;
          id: string;
          last_seen_at?: string | null;
          phone?: string | null;
          phone_verified?: boolean;
          presence_status?: string;
          role?: string | null;
          updated_at?: string;
        };
        Update: {
          about?: string | null;
          active_organization_id?: string | null;
          availability_mode?: string;
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          email_verified_at?: string | null;
          full_name?: string | null;
          id?: string;
          last_seen_at?: string | null;
          phone?: string | null;
          phone_verified?: boolean;
          presence_status?: string;
          role?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey";
            columns: ["active_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      public_profiles: {
        Row: {
          activity_visible: boolean;
          avatar_url: string | null;
          bio: string | null;
          completion_percent: number;
          display_name: string;
          email_audience: Database["public"]["Enums"]["profile_audience"];
          joined_at: string;
          languages: string[];
          message_audience: Database["public"]["Enums"]["profile_audience"];
          phone_audience: Database["public"]["Enums"]["profile_audience"];
          profile_audience: Database["public"]["Enums"]["profile_audience"];
          profile_id: string;
          reviews_visible: boolean;
          search_indexed: boolean;
          updated_at: string;
          username: string;
        };
        Insert: {
          activity_visible?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          completion_percent?: number;
          display_name: string;
          email_audience?: Database["public"]["Enums"]["profile_audience"];
          joined_at?: string;
          languages?: string[];
          message_audience?: Database["public"]["Enums"]["profile_audience"];
          phone_audience?: Database["public"]["Enums"]["profile_audience"];
          profile_audience?: Database["public"]["Enums"]["profile_audience"];
          profile_id: string;
          reviews_visible?: boolean;
          search_indexed?: boolean;
          updated_at?: string;
          username: string;
        };
        Update: {
          activity_visible?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          completion_percent?: number;
          display_name?: string;
          email_audience?: Database["public"]["Enums"]["profile_audience"];
          joined_at?: string;
          languages?: string[];
          message_audience?: Database["public"]["Enums"]["profile_audience"];
          phone_audience?: Database["public"]["Enums"]["profile_audience"];
          profile_audience?: Database["public"]["Enums"]["profile_audience"];
          profile_id?: string;
          reviews_visible?: boolean;
          search_indexed?: boolean;
          updated_at?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "public_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_progress: {
        Row: {
          completed_stages: Database["public"]["Enums"]["purchase_stage"][];
          current_stage: Database["public"]["Enums"]["purchase_stage"];
          id: string;
          listing_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_stages?: Database["public"]["Enums"]["purchase_stage"][];
          current_stage?: Database["public"]["Enums"]["purchase_stage"];
          id?: string;
          listing_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_stages?: Database["public"]["Enums"]["purchase_stage"][];
          current_stage?: Database["public"]["Enums"]["purchase_stage"];
          id?: string;
          listing_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_progress_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recognized_devices: {
        Row: {
          first_seen_at: string;
          id: string;
          label: string;
          last_seen_at: string;
          revoked_at: string | null;
          token_hash: string;
          user_id: string;
        };
        Insert: {
          first_seen_at?: string;
          id?: string;
          label: string;
          last_seen_at?: string;
          revoked_at?: string | null;
          token_hash: string;
          user_id: string;
        };
        Update: {
          first_seen_at?: string;
          id?: string;
          label?: string;
          last_seen_at?: string;
          revoked_at?: string | null;
          token_hash?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recognized_devices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      renter_profile_details: {
        Row: {
          employer: string | null;
          government_assistance: boolean | null;
          has_pets: boolean | null;
          household_size: number | null;
          monthly_income: number | null;
          move_in_date: string | null;
          nsfas_eligible: boolean | null;
          occupation: string | null;
          preferred_areas: string[];
          profile_id: string;
          rent_budget_max: number | null;
          rent_budget_min: number | null;
          smoking_preference: string | null;
          student_status: boolean | null;
          updated_at: string;
        };
        Insert: {
          employer?: string | null;
          government_assistance?: boolean | null;
          has_pets?: boolean | null;
          household_size?: number | null;
          monthly_income?: number | null;
          move_in_date?: string | null;
          nsfas_eligible?: boolean | null;
          occupation?: string | null;
          preferred_areas?: string[];
          profile_id: string;
          rent_budget_max?: number | null;
          rent_budget_min?: number | null;
          smoking_preference?: string | null;
          student_status?: boolean | null;
          updated_at?: string;
        };
        Update: {
          employer?: string | null;
          government_assistance?: boolean | null;
          has_pets?: boolean | null;
          household_size?: number | null;
          monthly_income?: number | null;
          move_in_date?: string | null;
          nsfas_eligible?: boolean | null;
          occupation?: string | null;
          preferred_areas?: string[];
          profile_id?: string;
          rent_budget_max?: number | null;
          rent_budget_min?: number | null;
          smoking_preference?: string | null;
          student_status?: boolean | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "renter_profile_details_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      search_alerts: {
        Row: {
          bounding_box_east: number;
          bounding_box_north: number;
          bounding_box_south: number;
          bounding_box_west: number;
          created_at: string;
          email: string;
          filters: Json | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          bounding_box_east: number;
          bounding_box_north: number;
          bounding_box_south: number;
          bounding_box_west: number;
          created_at?: string;
          email: string;
          filters?: Json | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          bounding_box_east?: number;
          bounding_box_north?: number;
          bounding_box_south?: number;
          bounding_box_west?: number;
          created_at?: string;
          email?: string;
          filters?: Json | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "search_alerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      seller_profile_details: {
        Row: {
          business_name: string | null;
          company_logo_url: string | null;
          office_location: string | null;
          profile_id: string;
          property_specialties: string[];
          updated_at: string;
        };
        Insert: {
          business_name?: string | null;
          company_logo_url?: string | null;
          office_location?: string | null;
          profile_id: string;
          property_specialties?: string[];
          updated_at?: string;
        };
        Update: {
          business_name?: string | null;
          company_logo_url?: string | null;
          office_location?: string | null;
          profile_id?: string;
          property_specialties?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seller_profile_details_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sensitive_access_grants: {
        Row: {
          admin_id: string;
          case_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          reason: string;
          resource_id: string;
          resource_type: string;
          revoked_at: string | null;
        };
        Insert: {
          admin_id: string;
          case_id: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          reason: string;
          resource_id: string;
          resource_type: string;
          revoked_at?: string | null;
        };
        Update: {
          admin_id?: string;
          case_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          reason?: string;
          resource_id?: string;
          resource_type?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sensitive_access_grants_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "moderation_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      showing_requests: {
        Row: {
          checked_in_at: string | null;
          completed_at: string | null;
          conversation_id: string | null;
          created_at: string;
          eta_minutes: number | null;
          expires_at: string;
          id: string;
          landlord_id: string;
          listing_id: string;
          renter_id: string;
          requested_at: string;
          responded_at: string | null;
          status: Database["public"]["Enums"]["showing_status"];
          window_choice: Database["public"]["Enums"]["showing_window"];
        };
        Insert: {
          checked_in_at?: string | null;
          completed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          eta_minutes?: number | null;
          expires_at: string;
          id?: string;
          landlord_id: string;
          listing_id: string;
          renter_id: string;
          requested_at?: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["showing_status"];
          window_choice: Database["public"]["Enums"]["showing_window"];
        };
        Update: {
          checked_in_at?: string | null;
          completed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          eta_minutes?: number | null;
          expires_at?: string;
          id?: string;
          landlord_id?: string;
          listing_id?: string;
          renter_id?: string;
          requested_at?: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["showing_status"];
          window_choice?: Database["public"]["Enums"]["showing_window"];
        };
        Relationships: [
          {
            foreignKeyName: "showing_requests_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "showing_requests_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "showing_requests_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "showing_requests_renter_id_fkey";
            columns: ["renter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      transparency_snapshots: {
        Row: {
          created_at: string;
          generated_by: string | null;
          id: string;
          metrics: Json;
          minimum_group_size: number;
          period_end: string;
          period_start: string;
          published_at: string | null;
          published_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          generated_by?: string | null;
          id?: string;
          metrics?: Json;
          minimum_group_size?: number;
          period_end: string;
          period_start: string;
          published_at?: string | null;
          published_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          generated_by?: string | null;
          id?: string;
          metrics?: Json;
          minimum_group_size?: number;
          period_end?: string;
          period_start?: string;
          published_at?: string | null;
          published_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trust_document_versions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          body_markdown: string;
          change_summary: string;
          counsel_reference: string | null;
          created_at: string;
          document_id: string;
          drafted_by: string | null;
          effective_at: string | null;
          external_reviewer_name: string | null;
          id: string;
          is_legacy_import: boolean;
          published_at: string | null;
          published_by: string | null;
          requires_reacceptance: boolean;
          reviewed_at: string | null;
          status: string;
          supersedes_id: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          body_markdown: string;
          change_summary?: string;
          counsel_reference?: string | null;
          created_at?: string;
          document_id: string;
          drafted_by?: string | null;
          effective_at?: string | null;
          external_reviewer_name?: string | null;
          id?: string;
          is_legacy_import?: boolean;
          published_at?: string | null;
          published_by?: string | null;
          requires_reacceptance?: boolean;
          reviewed_at?: string | null;
          status?: string;
          supersedes_id?: string | null;
          updated_at?: string;
          version: number;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          body_markdown?: string;
          change_summary?: string;
          counsel_reference?: string | null;
          created_at?: string;
          document_id?: string;
          drafted_by?: string | null;
          effective_at?: string | null;
          external_reviewer_name?: string | null;
          id?: string;
          is_legacy_import?: boolean;
          published_at?: string | null;
          published_by?: string | null;
          requires_reacceptance?: boolean;
          reviewed_at?: string | null;
          status?: string;
          supersedes_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "trust_document_versions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "trust_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trust_document_versions_supersedes_id_fkey";
            columns: ["supersedes_id"];
            isOneToOne: false;
            referencedRelation: "trust_document_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      trust_documents: {
        Row: {
          category: string;
          created_at: string;
          current_version_id: string | null;
          id: string;
          slug: string;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          current_version_id?: string | null;
          id?: string;
          slug: string;
          summary: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          current_version_id?: string | null;
          id?: string;
          slug?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trust_documents_current_version_fkey";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "trust_document_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_favorites: {
        Row: {
          created_at: string;
          id: string;
          listing_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          listing_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          listing_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_favorites_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_check_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          id: string;
          listing_id: string | null;
          profile_id: string | null;
          reason: string | null;
          status: string;
          verification_check_id: string;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          profile_id?: string | null;
          reason?: string | null;
          status: string;
          verification_check_id: string;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          profile_id?: string | null;
          reason?: string | null;
          status?: string;
          verification_check_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verification_check_history_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_check_history_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_check_history_verification_check_id_fkey";
            columns: ["verification_check_id"];
            isOneToOne: false;
            referencedRelation: "verification_checks";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_checks: {
        Row: {
          check_key: string;
          created_at: string;
          evidence_note: string | null;
          expires_at: string | null;
          id: string;
          listing_id: string | null;
          profile_id: string | null;
          public_label: string | null;
          rejected_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          revoked_at: string | null;
          status: string;
          submitted_at: string | null;
          updated_at: string;
          verified_at: string | null;
        };
        Insert: {
          check_key: string;
          created_at?: string;
          evidence_note?: string | null;
          expires_at?: string | null;
          id?: string;
          listing_id?: string | null;
          profile_id?: string | null;
          public_label?: string | null;
          rejected_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revoked_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          verified_at?: string | null;
        };
        Update: {
          check_key?: string;
          created_at?: string;
          evidence_note?: string | null;
          expires_at?: string | null;
          id?: string;
          listing_id?: string | null;
          profile_id?: string | null;
          public_label?: string | null;
          rejected_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revoked_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "verification_checks_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_checks_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      viewing_slot_offers: {
        Row: {
          application_id: string | null;
          buyer_interest_id: string | null;
          created_at: string;
          id: string;
          slot_id: string;
        };
        Insert: {
          application_id?: string | null;
          buyer_interest_id?: string | null;
          created_at?: string;
          id?: string;
          slot_id: string;
        };
        Update: {
          application_id?: string | null;
          buyer_interest_id?: string | null;
          created_at?: string;
          id?: string;
          slot_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "viewing_slot_offers_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_slot_offers_buyer_interest_id_fkey";
            columns: ["buyer_interest_id"];
            isOneToOne: false;
            referencedRelation: "buyer_interests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_slot_offers_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "viewing_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      viewing_slots: {
        Row: {
          created_at: string;
          created_by: string;
          end_time: string;
          id: string;
          is_booked: boolean;
          listing_id: string;
          mode: Database["public"]["Enums"]["viewing_mode"];
          start_time: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          end_time: string;
          id?: string;
          is_booked?: boolean;
          listing_id: string;
          mode?: Database["public"]["Enums"]["viewing_mode"];
          start_time: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          end_time?: string;
          id?: string;
          is_booked?: boolean;
          listing_id?: string;
          mode?: Database["public"]["Enums"]["viewing_mode"];
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: "viewing_slots_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_slots_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      viewings: {
        Row: {
          application_id: string | null;
          buyer_interest_id: string | null;
          created_at: string;
          id: string;
          meeting_ends_at: string | null;
          meeting_join_url: string | null;
          meeting_provider: string | null;
          meeting_room_id: string | null;
          meeting_starts_at: string | null;
          slot_id: string;
          status: Database["public"]["Enums"]["viewing_status"];
        };
        Insert: {
          application_id?: string | null;
          buyer_interest_id?: string | null;
          created_at?: string;
          id?: string;
          meeting_ends_at?: string | null;
          meeting_join_url?: string | null;
          meeting_provider?: string | null;
          meeting_room_id?: string | null;
          meeting_starts_at?: string | null;
          slot_id: string;
          status?: Database["public"]["Enums"]["viewing_status"];
        };
        Update: {
          application_id?: string | null;
          buyer_interest_id?: string | null;
          created_at?: string;
          id?: string;
          meeting_ends_at?: string | null;
          meeting_join_url?: string | null;
          meeting_provider?: string | null;
          meeting_room_id?: string | null;
          meeting_starts_at?: string | null;
          slot_id?: string;
          status?: Database["public"]["Enums"]["viewing_status"];
        };
        Relationships: [
          {
            foreignKeyName: "viewings_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewings_buyer_interest_id_fkey";
            columns: ["buyer_interest_id"];
            isOneToOne: false;
            referencedRelation: "buyer_interests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewings_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: true;
            referencedRelation: "viewing_slots";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_organization_invitation: {
        Args: { invitation_token_hash: string };
        Returns: string;
      };
      admin_add_case_note: {
        Args: {
          actor: string;
          audit_request_id: string;
          note_body: string;
          target_case: string;
        };
        Returns: string;
      };
      admin_bootstrap_owner: {
        Args: { audit_request_id: string; target_user: string };
        Returns: undefined;
      };
      admin_create_blog_draft: {
        Args: { actor: string; audit_request_id: string };
        Returns: string;
      };
      admin_create_sensitive_grant: {
        Args: {
          action_reason: string;
          actor: string;
          audit_request_id: string;
          target_case: string;
          target_resource: string;
          target_resource_type: string;
        };
        Returns: {
          expires_at: string;
          id: string;
        }[];
      };
      admin_delete_blog_post: {
        Args: { actor: string; audit_request_id: string; target_post: string };
        Returns: undefined;
      };
      admin_publish_trust_version: {
        Args: {
          actor: string;
          audit_request_id: string;
          target_version: string;
        };
        Returns: undefined;
      };
      admin_retry_notification: {
        Args: { actor: string; audit_request_id: string; target_event: string };
        Returns: string;
      };
      admin_revoke_user_sessions: {
        Args: { actor: string; audit_request_id: string; target_user: string };
        Returns: undefined;
      };
      admin_rollback_trust_version: {
        Args: {
          actor: string;
          audit_request_id: string;
          require_reacceptance?: boolean;
          source_version_id: string;
        };
        Returns: string;
      };
      admin_save_blog_post: {
        Args: {
          actor: string;
          audit_request_id: string;
          next_body_markdown: string;
          next_excerpt: string;
          next_slug: string;
          next_title: string;
          next_topic: string;
          target_post: string;
        };
        Returns: undefined;
      };
      admin_set_account_restriction: {
        Args: {
          action_reason: string;
          actor: string;
          audit_request_id: string;
          restore: boolean;
          target_user: string;
          until_at: string;
        };
        Returns: undefined;
      };
      admin_set_blog_post_status: {
        Args: {
          actor: string;
          audit_request_id: string;
          next_status: Database["public"]["Enums"]["blog_post_status"];
          target_post: string;
        };
        Returns: undefined;
      };
      admin_set_listing_restriction: {
        Args: {
          action_reason: string;
          actor: string;
          audit_request_id: string;
          restore: boolean;
          target_listing: string;
        };
        Returns: undefined;
      };
      admin_set_membership: {
        Args: {
          action_reason: string;
          actor: string;
          audit_request_id: string;
          next_level: Database["public"]["Enums"]["admin_level"];
          revoke: boolean;
          target_user: string;
        };
        Returns: undefined;
      };
      admin_set_nsfas_accreditation: {
        Args: {
          action_reason: string;
          actor: string;
          approved: boolean;
          audit_request_id: string;
          target_listing: string;
        };
        Returns: undefined;
      };
      admin_update_case: {
        Args: {
          actor: string;
          audit_request_id: string;
          next_assignee: string;
          next_priority: Database["public"]["Enums"]["moderation_priority"];
          next_resolution: string;
          next_status: Database["public"]["Enums"]["moderation_case_status"];
          target_case: string;
        };
        Returns: undefined;
      };
      apply_listing_import_bulk_patch: {
        Args: {
          target_job_id: string;
          target_patch: Json;
          target_selection: Json;
        };
        Returns: number;
      };
      apply_listing_import_row_results: {
        Args: {
          aggregate_delta?: Json;
          expected_stage: Database["public"]["Enums"]["listing_import_job_stage"];
          from_cursor: number;
          row_results: Json;
          target_job_id: string;
          to_cursor: number;
        };
        Returns: number;
      };
      assert_admin_actor: {
        Args: { actor: string; owner_only?: boolean };
        Returns: undefined;
      };
      book_buyer_viewing_slot_atomic: {
        Args: { target_buyer_interest_id: string; target_slot_id: string };
        Returns: string;
      };
      book_viewing_slot_atomic: {
        Args: { target_application_id: string; target_slot_id: string };
        Returns: string;
      };
      cancel_scheduled_live_tour: {
        Args: { target_tour_id: string };
        Returns: {
          new_status: string;
          result: string;
          tour_id: string;
        }[];
      };
      claim_listing_import_chunk: {
        Args: {
          chunk_size?: number;
          expected_cursor: number;
          expected_stage: Database["public"]["Enums"]["listing_import_job_stage"];
          expected_version: number;
          target_job_id: string;
        };
        Returns: {
          cancelled: boolean;
          claimed: boolean;
          created_by: string;
          cursor: number;
          organization_id: string;
          stage: Database["public"]["Enums"]["listing_import_job_stage"];
          version: number;
        }[];
      };
      create_listing_checked: {
        Args: {
          address: string;
          availability_date: string;
          bathrooms: number;
          bedrooms: number;
          description: string;
          electricity_estimate: number;
          electricity_included: boolean;
          electricity_type: string;
          latitude: number;
          lease_duration: string;
          longitude: number;
          metadata: Json;
          parking_count: number;
          parking_estimate: number;
          parking_included: boolean;
          parking_type: string;
          price: number;
          property_type: string;
          security_fee_estimate: number;
          title: string;
          water_availability: string;
          water_estimate: number;
          water_included: boolean;
          wifi_available: boolean;
          wifi_estimate: number;
          wifi_included: boolean;
        };
        Returns: {
          listing_id: string;
          result: string;
        }[];
      };
      create_listing_draft_checked: {
        Args: {
          address: string;
          latitude: number;
          listing_type: Database["public"]["Enums"]["listing_type"];
          longitude: number;
          price: number;
          property_type: string;
          sale_price: number;
          title: string;
        };
        Returns: {
          listing_id: string;
          result: string;
        }[];
      };
      create_organization: {
        Args: { organization_name: string; organization_slug: string };
        Returns: string;
      };
      delete_listing_checked: {
        Args: { target_listing_id: string };
        Returns: {
          listing_id: string;
          result: string;
        }[];
      };
      duplicate_listing: {
        Args: { target_listing_id: string };
        Returns: {
          listing_id: string;
          result: string;
        }[];
      };
      end_call_session: {
        Args: { action: string; target_session_id: string };
        Returns: {
          new_status: string;
          result: string;
        }[];
      };
      end_live_tour: {
        Args: { observed_peak_viewers?: number; target_tour_id: string };
        Returns: {
          new_status: string;
          result: string;
          tour_id: string;
        }[];
      };
      enqueue_profile_document_expiry_reminders: {
        Args: never;
        Returns: number;
      };
      find_listing_import_coordinate_duplicates: {
        Args: {
          target_latitude: number;
          target_listing_type: Database["public"]["Enums"]["listing_type"];
          target_longitude: number;
          target_organization_id: string;
        };
        Returns: {
          distance_metres: number;
          listing_id: string;
        }[];
      };
      find_listing_import_duplicate_candidates: {
        Args: {
          candidates: Json;
          provider_name: string;
          target_organization_id: string;
        };
        Returns: {
          distance_metres: number;
          listing_id: string;
          match_kind: string;
          row_number: number;
        }[];
      };
      finish_live_tour_recording: {
        Args: {
          target_error?: string;
          target_result: string;
          target_tour_id: string;
        };
        Returns: {
          new_status: string;
          result: string;
          tour_id: string;
        }[];
      };
      get_active_public_live_tour: {
        Args: { target_listing_id: string };
        Returns: {
          listing_id: string;
          started_at: string;
          tour_id: string;
        }[];
      };
      get_active_public_live_tours: {
        Args: { target_listing_ids: string[] };
        Returns: {
          listing_id: string;
          started_at: string;
          tour_id: string;
        }[];
      };
      get_my_auth_sessions: {
        Args: never;
        Returns: {
          created_at: string;
          id: string;
          ip: unknown;
          is_current: boolean;
          updated_at: string;
          user_agent: string;
        }[];
      };
      get_public_instant_connect_phase3_flags: {
        Args: never;
        Returns: {
          moderation: boolean;
          picture_in_picture: boolean;
          recording: boolean;
          scheduled_tours: boolean;
        }[];
      };
      get_public_listing_live_activity: {
        Args: { target_listing_id: string };
        Returns: {
          last_rented_at: string;
          last_scheduled_at: string;
          viewed_today: number;
          viewing_now: number;
        }[];
      };
      get_public_listing_trust_signals: {
        Args: { target_listing_ids: string[] };
        Returns: {
          expires_at: string;
          listing_id: string;
          public_label: string;
          verified_at: string;
        }[];
      };
      get_public_live_tour_status: {
        Args: { target_tour_id: string };
        Returns: {
          status: Database["public"]["Enums"]["live_tour_status"];
        }[];
      };
      get_published_listings_in_bbox: {
        Args: { east: number; north: number; south: number; west: number };
        Returns: {
          address: string;
          bathrooms: number;
          bedrooms: number;
          id: string;
          latitude: number;
          longitude: number;
          price: number;
          thumbnail_url: string;
          title: string;
        }[];
      };
      get_published_listings_in_bbox_with_query:
        | {
            Args: {
              east: number;
              max_price?: number;
              min_baths?: number;
              min_beds?: number;
              min_price?: number;
              north: number;
              property_type_filter?: string;
              search_query?: string;
              south: number;
              west: number;
            };
            Returns: {
              address: string;
              availability_date: string;
              bathrooms: number;
              bedrooms: number;
              created_at: string;
              id: string;
              image_urls: string[];
              landlord_avatar_url: string;
              landlord_id: string;
              landlord_name: string;
              landlord_phone_verified: boolean;
              latitude: number;
              longitude: number;
              price: number;
              property_type: string;
              thumbnail_url: string;
              title: string;
            }[];
          }
        | {
            Args: {
              available_now_filter?: boolean;
              east: number;
              instant_viewings_filter?: boolean;
              listing_type_filter?: Database["public"]["Enums"]["listing_type"];
              live_tours_filter?: boolean;
              max_price?: number;
              min_baths?: number;
              min_beds?: number;
              min_price?: number;
              north: number;
              property_type_filter?: string;
              replies_under_5_filter?: boolean;
              search_query?: string;
              south: number;
              west: number;
            };
            Returns: {
              address: string;
              availability_date: string;
              bathrooms: number;
              bedrooms: number;
              created_at: string;
              display_price: number;
              furnished: boolean;
              has_instant_viewing: boolean;
              has_live_tour: boolean;
              id: string;
              image_urls: string[];
              landlord_avatar_url: string;
              landlord_email_verified: boolean;
              landlord_id: string;
              landlord_median_first_response_seconds: number;
              landlord_name: string;
              landlord_phone_verified: boolean;
              landlord_predicted_response_seconds: number;
              landlord_presence_status: string;
              last_rented_at: string;
              last_scheduled_at: string;
              latitude: number;
              listing_reviewed_at: string;
              listing_type: Database["public"]["Enums"]["listing_type"];
              live_tour_id: string;
              longitude: number;
              nsfas_approved: boolean;
              parking_count: number;
              price: number;
              property_type: string;
              sale_price: number;
              thumbnail_url: string;
              title: string;
              viewed_today: number;
              viewing_now: number;
            }[];
          };
      get_upcoming_public_live_tour: {
        Args: { target_listing_id: string };
        Returns: {
          duration_minutes: number;
          listing_id: string;
          scheduled_at: string;
          tour_id: string;
        }[];
      };
      get_upcoming_public_live_tours: {
        Args: { target_listing_ids: string[] };
        Returns: {
          duration_minutes: number;
          listing_id: string;
          scheduled_at: string;
          tour_id: string;
        }[];
      };
      has_profile_persona: {
        Args: {
          expected_persona: Database["public"]["Enums"]["marketplace_persona"];
        };
        Returns: boolean;
      };
      has_profile_role: { Args: { expected_role: string }; Returns: boolean };
      is_current_account_active: { Args: never; Returns: boolean };
      is_listing_unrestricted: {
        Args: { target_listing_id: string };
        Returns: boolean;
      };
      publish_due_profile_reviews: { Args: never; Returns: number };
      purge_expired_live_tour_recording_links: { Args: never; Returns: number };
      record_auth_login_failure: {
        Args: {
          lockout_seconds?: number;
          lockout_threshold?: number;
          target_email_hash: string;
        };
        Returns: {
          attempt_count: number;
          email_hash: string;
          locked_until: string;
        }[];
      };
      refresh_landlord_trust_metrics: { Args: never; Returns: number };
      refresh_listing_import_job_counters: {
        Args: { target_job_id: string };
        Returns: undefined;
      };
      request_showing: {
        Args: {
          eta_minutes?: number;
          target_listing_id: string;
          window_choice: Database["public"]["Enums"]["showing_window"];
        };
        Returns: {
          request_id: string;
          result: string;
        }[];
      };
      respond_showing: {
        Args: { action: string; target_request_id: string };
        Returns: {
          new_status: string;
          result: string;
        }[];
      };
      schedule_live_tour: {
        Args: {
          target_duration_minutes?: number;
          target_join_url: string;
          target_listing_id: string;
          target_room_id: string;
          target_scheduled_at: string;
          target_tour_id: string;
        };
        Returns: {
          result: string;
          scheduled_at: string;
          tour_id: string;
        }[];
      };
      set_active_profile_persona: {
        Args: {
          target_persona: Database["public"]["Enums"]["marketplace_persona"];
        };
        Returns: Database["public"]["Enums"]["marketplace_persona"];
      };
      set_availability_mode: {
        Args: { target_mode: string };
        Returns: {
          availability_mode: string;
          presence_status: string;
        }[];
      };
      set_live_tour_recording_consent: {
        Args: {
          target_granted: boolean;
          target_policy_version?: string;
          target_tour_id: string;
        };
        Returns: {
          granted: boolean;
          result: string;
          tour_id: string;
        }[];
      };
      set_live_tour_recording_link: {
        Args: {
          target_external_id?: string;
          target_recording_url: string;
          target_tour_id: string;
        };
        Returns: {
          result: string;
          tour_id: string;
        }[];
      };
      showing_window_expiry: {
        Args: { choice: Database["public"]["Enums"]["showing_window"] };
        Returns: string;
      };
      start_call_session:
        | {
            Args: { target_conversation_id: string };
            Returns: {
              result: string;
              session_id: string;
            }[];
          }
        | {
            Args: {
              requested_media_mode: string;
              target_conversation_id: string;
            };
            Returns: {
              result: string;
              session_id: string;
            }[];
          };
      start_live_tour: {
        Args: {
          target_join_url: string;
          target_listing_id: string;
          target_room_id: string;
          target_tour_id: string;
        };
        Returns: {
          join_url: string;
          result: string;
          room_id: string;
          tour_id: string;
        }[];
      };
      start_live_tour_recording: {
        Args: { target_participant_ids: string[]; target_tour_id: string };
        Returns: {
          missing_consents: number;
          result: string;
          tour_id: string;
        }[];
      };
      start_scheduled_live_tour: {
        Args: { target_tour_id: string };
        Returns: {
          new_status: string;
          result: string;
          tour_id: string;
        }[];
      };
      submit_application_atomic: {
        Args: {
          document_metadata: Json;
          employment_status: string;
          full_name: string;
          household_size: number;
          income: number;
          move_in_date: string;
          target_application_id: string;
          target_listing_id: string;
        };
        Returns: {
          application_id: string;
          result: string;
        }[];
      };
      sweep_stale_presence: { Args: never; Returns: number };
      touch_presence: {
        Args: { desired?: string };
        Returns: {
          presence_status: string;
          result: string;
        }[];
      };
      update_application_status_checked: {
        Args: {
          target_application_id: string;
          target_status: Database["public"]["Enums"]["application_status"];
        };
        Returns: {
          application_id: string;
          result: string;
        }[];
      };
    };
    Enums: {
      admin_level: "owner" | "admin";
      application_status:
        | "submitted"
        | "under_review"
        | "shortlisted"
        | "rejected"
        | "approved"
        | "withdrawn";
      blog_media_kind: "cover" | "inline";
      blog_post_status: "draft" | "published";
      buyer_interest_status:
        | "interested"
        | "negotiating"
        | "accepted"
        | "declined";
      call_status: "ringing" | "active" | "ended" | "declined" | "missed";
      conversation_type: "inquiry" | "application";
      document_type: "id" | "payslip";
      listing_import_asset_state:
        | "uploaded"
        | "url_pending"
        | "matched"
        | "unmatched"
        | "rejected"
        | "attached";
      listing_import_duplicate_strategy:
        | "skip"
        | "replace"
        | "merge"
        | "import_new";
      listing_import_issue_severity: "blocking" | "publish_blocker" | "warning";
      listing_import_job_stage:
        | "source"
        | "upload"
        | "mapping"
        | "validating"
        | "resolving"
        | "preview"
        | "committing"
        | "confirming"
        | "complete"
        | "cancelled"
        | "failed";
      listing_import_row_state:
        | "pending"
        | "parse_blocked"
        | "draft_ready"
        | "publish_blocked"
        | "warning"
        | "duplicate_review"
        | "committed"
        | "published"
        | "skipped"
        | "failed"
        | "removed";
      listing_import_source_kind:
        | "csv"
        | "xlsx"
        | "xml"
        | "json"
        | "pasted_table"
        | "image_archive"
        | "image_folder"
        | "image_urls"
        | "pinpoint_v1";
      listing_status: "draft" | "published" | "archived";
      listing_type: "rent" | "sale";
      live_tour_recording_status:
        | "off"
        | "awaiting_consent"
        | "recording"
        | "stopped"
        | "failed";
      live_tour_status: "scheduled" | "live" | "ended" | "cancelled";
      marketplace_persona: "renter" | "buyer" | "landlord" | "seller";
      moderation_case_status: "open" | "in_review" | "resolved" | "dismissed";
      moderation_category:
        | "fraud_or_scam"
        | "misleading_listing"
        | "duplicate_or_spam"
        | "discrimination"
        | "harassment"
        | "safety"
        | "privacy"
        | "other";
      moderation_priority: "low" | "normal" | "high" | "urgent";
      notification_category:
        | "messages"
        | "applications"
        | "viewings"
        | "offers"
        | "saved_searches"
        | "marketing"
        | "security"
        | "account_updates"
        | "reviews"
        | "verification"
        | "blog_updates";
      notification_channel: "in_app" | "email";
      notification_frequency:
        | "instant"
        | "hourly"
        | "daily"
        | "weekly"
        | "never";
      notification_type:
        | "new_application"
        | "new_message"
        | "viewing_proposed"
        | "viewing_booked"
        | "application_status_changed"
        | "incoming_call"
        | "admin_alert"
        | "moderation_update"
        | "showing_request"
        | "showing_accepted"
        | "showing_declined"
        | "live_tour_started"
        | "live_tour_scheduled"
        | "live_tour_reminder"
        | "profile_document_expiry";
      organization_role: "owner" | "admin" | "agent";
      profile_activity_visibility: "private" | "public";
      profile_audience: "everyone" | "members" | "interactions" | "no_one";
      profile_review_status:
        | "draft"
        | "submitted"
        | "published"
        | "hidden"
        | "removed";
      purchase_stage:
        | "property_saved"
        | "viewing_scheduled"
        | "viewing_completed"
        | "contacted_seller"
        | "negotiating"
        | "sale_agreed"
        | "purchase_complete";
      showing_status:
        | "requested"
        | "accepted"
        | "checked_in"
        | "declined"
        | "completed"
        | "cancelled"
        | "expired";
      showing_window: "now" | "within_15" | "within_30" | "today";
      viewing_mode: "in_person" | "video_call";
      viewing_status: "booked" | "cancelled" | "completed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          format: string;
          id: string;
          name: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      buckets_vectors: {
        Row: {
          created_at: string;
          id: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      iceberg_namespaces: {
        Row: {
          bucket_name: string;
          catalog_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_name: string;
          catalog_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_name?: string;
          catalog_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "buckets_analytics";
            referencedColumns: ["id"];
          },
        ];
      };
      iceberg_tables: {
        Row: {
          bucket_name: string;
          catalog_id: string;
          created_at: string;
          id: string;
          location: string;
          name: string;
          namespace_id: string;
          remote_table_id: string | null;
          shard_id: string | null;
          shard_key: string | null;
          updated_at: string;
        };
        Insert: {
          bucket_name: string;
          catalog_id: string;
          created_at?: string;
          id?: string;
          location: string;
          name: string;
          namespace_id: string;
          remote_table_id?: string | null;
          shard_id?: string | null;
          shard_key?: string | null;
          updated_at?: string;
        };
        Update: {
          bucket_name?: string;
          catalog_id?: string;
          created_at?: string;
          id?: string;
          location?: string;
          name?: string;
          namespace_id?: string;
          remote_table_id?: string | null;
          shard_id?: string | null;
          shard_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "buckets_analytics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey";
            columns: ["namespace_id"];
            isOneToOne: false;
            referencedRelation: "iceberg_namespaces";
            referencedColumns: ["id"];
          },
        ];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          metadata: Json | null;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "s3_multipart_uploads";
            referencedColumns: ["id"];
          },
        ];
      };
      vector_indexes: {
        Row: {
          bucket_id: string;
          created_at: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id: string;
          metadata_configuration: Json | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id?: string;
          metadata_configuration?: Json | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          data_type?: string;
          dimension?: number;
          distance_metric?: string;
          id?: string;
          metadata_configuration?: Json | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets_vectors";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] };
        Returns: boolean;
      };
      allow_only_operation: {
        Args: { expected_operation: string };
        Returns: boolean;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      extension: { Args: { name: string }; Returns: string };
      filename: { Args: { name: string }; Returns: string };
      foldername: { Args: { name: string }; Returns: string[] };
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string };
        Returns: string;
      };
      get_size_by_bucket: {
        Args: never;
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          prefix_param: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      operation: { Args: never; Returns: string };
      search: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_by_timestamp: {
        Args: {
          p_bucket_id: string;
          p_level: number;
          p_limit: number;
          p_prefix: string;
          p_sort_column: string;
          p_sort_column_after: string;
          p_sort_order: string;
          p_start_after: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          levels?: number;
          limits?: number;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
      listing_import_asset_state: [
        "uploaded",
        "url_pending",
        "matched",
        "unmatched",
        "rejected",
        "attached",
      ],
      listing_import_duplicate_strategy: [
        "skip",
        "replace",
        "merge",
        "import_new",
      ],
      listing_import_issue_severity: ["blocking", "publish_blocker", "warning"],
      listing_import_job_stage: [
        "source",
        "upload",
        "mapping",
        "validating",
        "resolving",
        "preview",
        "committing",
        "confirming",
        "complete",
        "cancelled",
        "failed",
      ],
      listing_import_row_state: [
        "pending",
        "parse_blocked",
        "draft_ready",
        "publish_blocked",
        "warning",
        "duplicate_review",
        "committed",
        "published",
        "skipped",
        "failed",
        "removed",
      ],
      listing_import_source_kind: [
        "csv",
        "xlsx",
        "xml",
        "json",
        "pasted_table",
        "image_archive",
        "image_folder",
        "image_urls",
        "pinpoint_v1",
      ],
      listing_status: ["draft", "published", "archived"],
      listing_type: ["rent", "sale"],
      live_tour_recording_status: [
        "off",
        "awaiting_consent",
        "recording",
        "stopped",
        "failed",
      ],
      live_tour_status: ["scheduled", "live", "ended", "cancelled"],
      marketplace_persona: ["renter", "buyer", "landlord", "seller"],
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
      notification_category: [
        "messages",
        "applications",
        "viewings",
        "offers",
        "saved_searches",
        "marketing",
        "security",
        "account_updates",
        "reviews",
        "verification",
        "blog_updates",
      ],
      notification_channel: ["in_app", "email"],
      notification_frequency: ["instant", "hourly", "daily", "weekly", "never"],
      notification_type: [
        "new_application",
        "new_message",
        "viewing_proposed",
        "viewing_booked",
        "application_status_changed",
        "incoming_call",
        "admin_alert",
        "moderation_update",
        "showing_request",
        "showing_accepted",
        "showing_declined",
        "live_tour_started",
        "live_tour_scheduled",
        "live_tour_reminder",
        "profile_document_expiry",
      ],
      organization_role: ["owner", "admin", "agent"],
      profile_activity_visibility: ["private", "public"],
      profile_audience: ["everyone", "members", "interactions", "no_one"],
      profile_review_status: [
        "draft",
        "submitted",
        "published",
        "hidden",
        "removed",
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
      showing_status: [
        "requested",
        "accepted",
        "checked_in",
        "declined",
        "completed",
        "cancelled",
        "expired",
      ],
      showing_window: ["now", "within_15", "within_30", "today"],
      viewing_mode: ["in_person", "video_call"],
      viewing_status: ["booked", "cancelled", "completed"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const;
