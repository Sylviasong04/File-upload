import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { env } from "@/lib/env";
import { ManagedFile, supabaseAdmin } from "@/lib/supabase-admin";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("files")
    .select("id, original_name, mime_type, size_bytes, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data satisfies Partial<ManagedFile>[] });
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "请提供文件字段 file" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "文件内容为空" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "文件大小超过 10MB 限制" }, { status: 400 });
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;

  const uploadRes = await supabaseAdmin.storage.from(env.supabaseStorageBucket).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (uploadRes.error) {
    return NextResponse.json({ error: `存储上传失败: ${uploadRes.error.message}` }, { status: 500 });
  }

  const insertRes = await supabaseAdmin
    .from("files")
    .insert({
      original_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_path: storagePath
    })
    .select("id, original_name, mime_type, size_bytes, created_at")
    .single();

  if (insertRes.error) {
    await supabaseAdmin.storage.from(env.supabaseStorageBucket).remove([storagePath]);
    return NextResponse.json({ error: `数据库写入失败: ${insertRes.error.message}` }, { status: 500 });
  }

  return NextResponse.json({ data: insertRes.data }, { status: 201 });
}
