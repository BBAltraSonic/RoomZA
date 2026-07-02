import { createClient } from "@/lib/supabase/server";

export async function getNeighborhoodMetadata(slug: string) {
  const supabase = await createClient();
  const { data: neighborhood } = await supabase
    .from("neighborhoods")
    .select("name, description")
    .eq("slug", slug)
    .single();

  return neighborhood;
}

export async function getNeighborhoodPageData(slug: string) {
  const supabase = await createClient();

  const { data: neighborhood, error } = await supabase
    .from("neighborhoods")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !neighborhood) {
    return null;
  }

  const { data: listings } = await supabase.rpc("get_published_listings_in_bbox", {
    west: neighborhood.bounding_box_west,
    south: neighborhood.bounding_box_south,
    east: neighborhood.bounding_box_east,
    north: neighborhood.bounding_box_north,
  });

  return { neighborhood, listings: listings ?? [] };
}
