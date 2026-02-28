import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ManagedFile, getStorageBucket, getSupabaseAdmin } from "@/lib/supabase-admin";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const runtime = "nodejs";

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("files")
    .select("id, original_name, mime_type, size_bytes, created_at, ai_summary")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data satisfies Partial<ManagedFile>[] });
}

function isPdfMimeOrName(file: File) {
  const mimeLooksPdf = file.type === "application/pdf";
  const nameLooksPdf = file.name.toLowerCase().endsWith(".pdf");
  return mimeLooksPdf || nameLooksPdf;
}

function hasPdfMagicHeader(bytes: Uint8Array) {
  if (bytes.length < 5) return false;
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  return header === "%PDF-";
}

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const storageBucket = getStorageBucket();
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "请提供文件字段 file" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "文件内容为空" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "文件大小超过 20MB 限制" }, { status: 400 });
  }

  if (!isPdfMimeOrName(file)) {
    return NextResponse.json({ error: "仅支持上传 PDF 文件" }, { status: 400 });
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfMagicHeader(fileBytes)) {
    return NextResponse.json({ error: "文件内容不是有效 PDF" }, { status: 400 });
  }

  const storagePath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.pdf`;

  const uploadRes = await supabaseAdmin.storage.from(storageBucket).upload(storagePath, fileBytes, {
    contentType: "application/pdf",
    upsert: false
  });

  if (uploadRes.error) {
    return NextResponse.json({ error: `存储上传失败: ${uploadRes.error.message}` }, { status: 500 });
  }

  const insertRes = await supabaseAdmin
    .from("files")
    .insert({
      original_name: file.name,
      mime_type: "application/pdf",
      size_bytes: file.size,
      storage_path: storagePath
    })
    .select("id, original_name, mime_type, size_bytes, created_at")
    .single();

  if (insertRes.error) {
    await supabaseAdmin.storage.from(storageBucket).remove([storagePath]);
    return NextResponse.json({ error: `数据库写入失败: ${insertRes.error.message}` }, { status: 500 });
  }

  return NextResponse.json({ data: insertRes.data }, { status: 201 });
}
