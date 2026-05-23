import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, bbox, filters } = body;

    if (!email || !bbox || typeof bbox.west !== "number") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase.from("search_alerts").insert({
      email,
      bounding_box_west: bbox.west,
      bounding_box_south: bbox.south,
      bounding_box_east: bbox.east,
      bounding_box_north: bbox.north,
      filters: filters || null,
      user_id: session?.user?.id || null,
    });

    if (error) {
      console.error("Error creating search alert:", error);
      return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
