import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const fileId = params.id;

  const getRes = await supabaseAdmin
    .from("files")
    .select("id, storage_path")
    .eq("id", fileId)
    .single();

  if (getRes.error) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const signedRes = await supabaseAdmin.storage
    .from(env.supabaseStorageBucket)
    .createSignedUrl(getRes.data.storage_path as string, 3600);

  if (signedRes.error || !signedRes.data?.signedUrl) {
    return NextResponse.json({ error: `生成预览链接失败: ${signedRes.error?.message || "未知错误"}` }, { status: 500 });
  }

  return NextResponse.json(
    { data: { url: signedRes.data.signedUrl } },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    }
  );
}
