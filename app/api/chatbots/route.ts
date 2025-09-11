import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

function mapRow(x:any,i:number){
  return {
    id: String(x.id),
    name: String(x.name ?? `Agent ${i+1}`),
    model: String(x.model ?? "gpt-4o"),
    temperature: typeof x.temperature==="number"?x.temperature:0.5,
    createdAt: new Date(x.updated_at ?? x.created_at ?? Date.now()).getTime(),
    system: x.system_prompt ?? null,
    profile: x.profile ?? null,
    builderPrompt: x.builder_prompt ?? null,
    meta: x.meta ?? null,
  };
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data:{ user }, error: ue } = await supabase.auth.getUser();
    if (ue) throw ue;
    if (!user) return NextResponse.json({ items: [] });

    const { data, error } = await supabase
      .from("agents")
      .select("id,name,model,temperature,system_prompt,profile,builder_prompt,meta,created_at,updated_at,user_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending:false });
    if (error) throw error;

    return NextResponse.json({ items:(data??[]).map(mapRow), sourceTable:"agents" });
  } catch (e:any) {
    return NextResponse.json({ items:[], error:e?.message ?? "failed" }, { status:200 });
  }
}
