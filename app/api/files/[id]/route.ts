import { NextResponse } from "next/server";
import { getStorageBucket, getSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const fileId = params.id;
  const supabaseAdmin = getSupabaseAdmin();
  const storageBucket = getStorageBucket();

  const getRes = await supabaseAdmin
    .from("files")
    .select("id, storage_path")
    .eq("id", fileId)
    .single();

  if (getRes.error) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const row = getRes.data as unknown as { storage_path: string };
  const storagePath = row.storage_path;

  const storageRes = await supabaseAdmin.storage.from(storageBucket).remove([storagePath]);

  if (storageRes.error) {
    return NextResponse.json({ error: `删除存储文件失败: ${storageRes.error.message}` }, { status: 500 });
  }

  const dbRes = await supabaseAdmin.from("files").delete().eq("id", fileId);

  if (dbRes.error) {
    return NextResponse.json({ error: `删除数据库记录失败: ${dbRes.error.message}` }, { status: 500 });
  }

  return NextResponse.json({ data: { id: fileId } });
}
