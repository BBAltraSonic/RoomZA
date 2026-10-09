import "server-only";
import { z } from "zod";
import {
  createClient as createAnonymousClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/features/admin/auth";
import type { Database, Json } from "@/lib/supabase/types";
import {
  serviceDraftSchema,
  serviceSubmissionSchema,
  publicServiceSchema,
  serviceContentSchema,
  serviceFeedSchema,
} from "./schema";
type Table<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
type ServiceDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      service_submissions: Table<{
        id: string;
        poster_id: string;
        version: number;
        status: string;
        draft: Json;
        submitted: Json | null;
        updated_at: string;
      }>;
      approved_services: Table<{
        id: string;
        area_id: string;
        content: Json;
        approved_at: string;
      }>;
    };
    Functions: Database["public"]["Functions"] & {
      pinpoint_service_write: {
        Args: {
          command: string;
          target: string;
          expected_version: number;
          payload?: Json;
          permission_confirmed?: boolean;
        };
        Returns: Json;
      };
      pinpoint_service_review_queue: {
        Args: Record<string, never>;
        Returns: Json;
      };
      pinpoint_service_decide: {
        Args: {
          target: string;
          expected_version: number;
          decision: string;
          authority_notes: string;
          location_notes?: string;
        };
        Returns: Json;
      };
    };
  };
};
async function session() {
  return (await createClient()) as unknown as SupabaseClient<ServiceDatabase>;
}
export async function readOwnedServices() {
  const { user } = await requireUser({ redirectTo: "/post/services" });
  const client = await session();
  const { data, error } = await client
    .from("service_submissions")
    .select("id,version,status,draft,submitted,updated_at")
    .eq("poster_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return z.array(serviceSubmissionSchema).parse(data);
}
export async function writeService(input: {
  command: "create" | "save" | "submit" | "withdraw";
  id: string;
  expectedVersion: number;
  draft?: unknown;
  permissionConfirmed?: boolean;
}) {
  await requireUser({ redirectTo: "/post/services" });
  const client = await session();
  const { data, error } = await client.rpc("pinpoint_service_write", {
    command: input.command,
    target: z.string().uuid().parse(input.id),
    expected_version: z
      .number()
      .int()
      .min(input.command === "create" ? 0 : 1)
      .max(2147483646)
      .parse(input.expectedVersion),
    payload:
      input.command === "save" ? serviceDraftSchema.parse(input.draft) : {},
    permission_confirmed: input.permissionConfirmed === true,
  });
  if (error) throw error;
  return z
    .object({
      id: z.string().uuid(),
      version: z.number().int().positive(),
      status: z.string(),
    })
    .parse(data);
}
export async function readServiceReviewQueue() {
  await requireAdmin({ redirectTo: "/admin/services" });
  const client = await session();
  const { data, error } = await client.rpc("pinpoint_service_review_queue", {});
  if (error) throw error;
  return z
    .array(
      z.object({
        id: z.string().uuid(),
        version: z.number().int().positive(),
        status: z.string(),
        submitted: serviceContentSchema,
        updated_at: z.string(),
        published: z.boolean(),
      }),
    )
    .parse(data);
}
export async function decideService(input: {
  id: string;
  version: number;
  decision: "approve" | "reject" | "unpublish";
  authorityNotes: string;
  locationNotes: string;
}) {
  await requireAdmin({ redirectTo: "/admin/services" });
  const client = await session();
  const { error } = await client.rpc("pinpoint_service_decide", {
    target: z.string().uuid().parse(input.id),
    expected_version: z.number().int().positive().parse(input.version),
    decision: input.decision,
    authority_notes: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .parse(input.authorityNotes),
    location_notes: z.string().trim().max(2000).parse(input.locationNotes),
  });
  if (error) throw error;
}
export async function readServiceFeed(areaId: string, page = 1) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const client = createAnonymousClient<ServiceDatabase>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
  const offset = (z.number().int().min(1).max(10000).parse(page) - 1) * 20;
  const { data, count, error } = await client
    .from("approved_services")
    .select("id,area_id,content,approved_at", { count: "exact" })
    .eq("area_id", z.string().uuid().parse(areaId))
    .order("approved_at", { ascending: false })
    .order("id")
    .range(offset, offset + 19);
  if (error) throw error;
  if (count === null) throw new Error("Service count unavailable");
  const items = z.array(publicServiceSchema).parse(data);
  return serviceFeedSchema.parse({
    areaId,
    totalCount: count,
    page,
    items,
    hasNext: count > offset + items.length,
  });
}

export async function readOwnedService(id: string) {
  const { user } = await requireUser({ redirectTo: "/post/services/" + id });
  const client = await session();
  const { data, error } = await client
    .from("service_submissions")
    .select("id,version,status,draft,submitted,updated_at")
    .eq("id", z.string().uuid().parse(id))
    .eq("poster_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? serviceSubmissionSchema.parse(data) : null;
}
