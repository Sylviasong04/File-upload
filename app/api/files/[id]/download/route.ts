import { NextResponse } from "next/server";
import { getStorageBucket, getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const fileId = params.id;
  const supabaseAdmin = getSupabaseAdmin();
  const storageBucket = getStorageBucket();

  const getRes = await supabaseAdmin
    .from("files")
    .select("id, original_name, storage_path")
    .eq("id", fileId)
    .single();

  if (getRes.error) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const row = getRes.data as unknown as { storage_path: string; original_name: string };
  const path = row.storage_path;

  const signedRes = await supabaseAdmin.storage
    .from(storageBucket)
    .createSignedUrl(path, 600, {
      download: row.original_name
    });

  if (signedRes.error || !signedRes.data?.signedUrl) {
    return NextResponse.json({ error: `生成下载链接失败: ${signedRes.error?.message || "未知错误"}` }, { status: 500 });
  }

  return NextResponse.json(
    { data: { url: signedRes.data.signedUrl } },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      }
    }
  );
}
