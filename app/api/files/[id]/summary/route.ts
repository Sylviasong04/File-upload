import { NextResponse } from "next/server";
import OpenAI from "openai";
import pdfParse from "pdf-parse";
import { env } from "@/lib/env";
import { getStorageBucket, getSupabaseAdmin } from "@/lib/supabase-admin";

const MAX_TEXT_CHARS = 18000;

function normalizeText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!env.openaiApiKey) {
    return NextResponse.json({ error: "未配置 OPENAI_API_KEY，无法生成 AI 摘要" }, { status: 500 });
  }

  const fileId = params.id;
  const supabaseAdmin = getSupabaseAdmin();
  const storageBucket = getStorageBucket();

  const getRes = await supabaseAdmin
    .from("files")
    .select("id, original_name, storage_path, mime_type")
    .eq("id", fileId)
    .single();

  if (getRes.error) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const row = getRes.data as unknown as { original_name: string; storage_path: string; mime_type: string | null };

  const mimeType = (row.mime_type || "").toLowerCase();
  if (mimeType !== "application/pdf" && !row.original_name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "仅支持 PDF 文档摘要" }, { status: 400 });
  }

  const downloadRes = await supabaseAdmin.storage
    .from(storageBucket)
    .download(row.storage_path);

  if (downloadRes.error || !downloadRes.data) {
    return NextResponse.json({ error: `下载 PDF 失败: ${downloadRes.error?.message || "未知错误"}` }, { status: 500 });
  }

  const buffer = Buffer.from(await downloadRes.data.arrayBuffer());

  let parsedText = "";
  try {
    const parsed = await pdfParse(buffer);
    parsedText = normalizeText(parsed.text || "");
  } catch {
    return NextResponse.json({ error: "PDF 解析失败，无法生成摘要" }, { status: 500 });
  }

  if (!parsedText) {
    return NextResponse.json({ error: "PDF 未提取到可用文本" }, { status: 400 });
  }

  const clippedText = parsedText.slice(0, MAX_TEXT_CHARS);
  const openai = new OpenAI({
    apiKey: env.openaiApiKey,
    baseURL: env.openaiBaseUrl
  });
  let summary = "";

  try {
    const response = await openai.chat.completions.create({
      model: env.openaiModel,
      messages: [
        {
          role: "system",
          content: " You are a document analysis assistant. Please generate a summary based on the original document. The summary should be well-structured, accurately preserve the key conclusions, and use language grounded in the original document."
        },
        {
          role: "user",
          content: `Please generate a structured summary of the following PDF text:
        
        ${clippedText}
        
        Requirements:
        - Base the summary strictly on the original text.
        - Preserve key arguments and conclusions.
        - Do not add new information.
        
        Output Format:
        1) Three-Sentence Overview
        2) Key Points (3–6 bullet points)
        3) One-Sentence Conclusion`
        }
      ]
    });
    summary = response.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("AI summary failed:", message);
    return NextResponse.json(
      { error: "调用 AI 模型失败，请检查 OPENAI_API_KEY 和模型配置", detail: message },
      { status: 500 }
    );
  }

  if (!summary) {
    return NextResponse.json({ error: "AI 未返回摘要结果" }, { status: 500 });
  }

  const saveRes = await supabaseAdmin
    .from("files")
    .update({ ai_summary: summary })
    .eq("id", fileId);

  if (saveRes.error) {
    return NextResponse.json({ error: `摘要已生成但保存失败: ${saveRes.error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      summary,
      sourceChars: clippedText.length,
      model: env.openaiModel
    }
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const fileId = params.id;
  const supabaseAdmin = getSupabaseAdmin();
  const body = await req.json().catch(() => null);

  if (!body || typeof body.summary !== "string") {
    return NextResponse.json({ error: "请提供 summary 字段" }, { status: 400 });
  }

  const updateRes = await supabaseAdmin
    .from("files")
    .update({ ai_summary: body.summary })
    .eq("id", fileId)
    .select("id, ai_summary")
    .single();

  if (updateRes.error) {
    return NextResponse.json({ error: `摘要保存失败: ${updateRes.error.message}` }, { status: 500 });
  }

  return NextResponse.json({ data: updateRes.data });
}
