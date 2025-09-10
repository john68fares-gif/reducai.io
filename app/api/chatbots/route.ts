// app/api/chatbots/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

// Shape the DB row → UI agent
function mapRowToAgent(x: any, i: number) {
  const id = String(x.id);
  const name = String(x.name ?? `Agent ${i + 1}`);
  const model = String(x.model ?? "gpt-4o");
  const temperature =
    typeof x.temperature === "number"
      ? x.temperature
      : 0.5;

  const createdAt = new Date(
    x.created_at ?? x.updated_at ?? Date.now()
  ).getTime();

  return {
    id,
    name,
    model,
    temperature,
    createdAt,
    // optional extras (if you store them)
    system: x.system_prompt ?? null,
    profile: x.profile ?? null,
    builderPrompt: x.builder_prompt ?? null,
    meta: x.meta ?? null,
  };
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return NextResponse.json({ items: [] });

    // Use your real table name: "agents"
    const { data, error } = await supabase
      .from("agents")
      .select(
        "id,name,model,temperature,system_prompt,profile,builder_prompt,meta,created_at,updated_at,user_id"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const items = (data ?? []).map(mapRowToAgent);
    return NextResponse.json({ items, sourceTable: "agents" });
  } catch (e: any) {
    return NextResponse.json(
      { items: [], error: e?.message ?? "failed" },
      { status: 200 }
    );
  }
}
