// app/api/chatbots/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// Adjust this table & columns to match your schema.
// Expected columns: id, user_id, name, model, temperature, system_prompt, profile, builder_prompt, meta (json)
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userErr
    } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return NextResponse.json({ items: [] });

    // Prefer your real table: 'chatbots' or 'agents'
    const { data, error } = await supabase
      .from("chatbots")
      .select("id,name,model,temperature,system_prompt,profile,builder_prompt,meta,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    // Normalize to the shape Improve expects
    const items = (data ?? []).map((x: any, i: number) => ({
      id: String(x.id),
      name: x.name || `Agent ${i + 1}`,
      model: x.model || "gpt-4o",
      temperature: typeof x.temperature === "number" ? x.temperature : 0.5,
      createdAt: new Date(x.created_at || x.updated_at || Date.now()).getTime(),
      // extra fields Improve may want later when composing system prompt
      system: x.system_prompt ?? null,
      profile: x.profile ?? null,
      builderPrompt: x.builder_prompt ?? null,
      meta: x.meta ?? null,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || "Failed to load" }, { status: 200 });
  }
}
