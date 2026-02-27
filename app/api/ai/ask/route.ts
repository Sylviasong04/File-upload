import { NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  if (!env.openaiApiKey) {
    return NextResponse.json({ error: "未配置 OPENAI_API_KEY" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const selection = typeof body?.selection === "string" ? body.selection.trim() : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!selection || !question) {
    return NextResponse.json({ error: "请提供 selection 和 question" }, { status: 400 });
  }

  const openai = new OpenAI({
    apiKey: env.openaiApiKey,
    baseURL: env.openaiBaseUrl
  });

  try {
    const response = await openai.chat.completions.create({
      model: env.openaiModel,
      messages: [
        {
          role: "system",
          content:
            "你是简洁的问答助手。优先基于给定片段作答；若片段不足以回答，可使用通用知识补充。只输出最终答案，不要解释是否来自片段。"
        },
        {
          role: "user",
          content: `片段：\n${selection}\n\n问题：${question}\n\n请给出简洁回答：`
        }
      ]
    });

    const answer = response.choices?.[0]?.message?.content?.trim() || "";
    if (!answer) {
      return NextResponse.json({ error: "AI 未返回回答" }, { status: 500 });
    }

    return NextResponse.json({ data: { answer } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("AI ask failed:", message);
    return NextResponse.json({ error: "调用 AI 模型失败", detail: message }, { status: 500 });
  }
}
