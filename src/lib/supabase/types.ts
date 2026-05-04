export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      listing_images: {
        Row: {
          id: string;
          listing_id: string;
          bucket: string;
          path: string;
          public_url: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          bucket?: string;
          path: string;
          public_url: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          bucket?: string;
          path?: string;
          public_url?: string;
          sort_order?: number;
          created_at?: string;
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
      listings: {
        Row: {
          id: string;
          landlord_id: string;
          title: string;
          price: number;
          address: string;
          latitude: number;
          longitude: number;
          bedrooms: number;
          bathrooms: number;
          parking_type: string;
          parking_count: number;
          electricity_type: string;
          water_availability: string;
          lease_duration: string;
          availability_date: string;
          metadata: Json;
          status: "draft" | "published" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          landlord_id: string;
          title: string;
          price: number;
          address: string;
          latitude: number;
          longitude: number;
          bedrooms: number;
          bathrooms: number;
          parking_type: string;
          parking_count?: number;
          electricity_type: string;
          water_availability: string;
          lease_duration: string;
          availability_date: string;
          metadata?: Json;
          status?: "draft" | "published" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          landlord_id?: string;
          title?: string;
          price?: number;
          address?: string;
          latitude?: number;
          longitude?: number;
          bedrooms?: number;
          bathrooms?: number;
          parking_type?: string;
          parking_count?: number;
          electricity_type?: string;
          water_availability?: string;
          lease_duration?: string;
          availability_date?: string;
          metadata?: Json;
          status?: "draft" | "published" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listings_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          phone_verified: boolean;
          role: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          phone?: string | null;
          phone_verified?: boolean;
          role?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string | null;
          phone_verified?: boolean;
          role?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_published_listings_in_bbox: {
        Args: {
          west: number;
          south: number;
          east: number;
          north: number;
        };
        Returns: {
          id: string;
          title: string;
          address: string;
          price: number;
          latitude: number;
          longitude: number;
          bedrooms: number;
          bathrooms: number;
          thumbnail_url: string | null;
        }[];
      };
    };
    Enums: {
      listing_status: "draft" | "published" | "archived";
    };
    CompositeTypes: Record<string, never>;
  };
};
