"use client";

import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

type FileItem = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
  ai_summary?: string | null;
};

function bytesToReadable(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isPdfFile(file: File) {
  const mimeLooksPdf = file.type === "application/pdf";
  const nameLooksPdf = file.name.toLowerCase().endsWith(".pdf");
  return mimeLooksPdf || nameLooksPdf;
}

export default function HomePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewFileId, setPreviewFileId] = useState<string>("");
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [summaryFileId, setSummaryFileId] = useState<string>("");
  const [summaryFileName, setSummaryFileName] = useState<string>("");
  const [summaryText, setSummaryText] = useState<string>("");
  const [summaryDraft, setSummaryDraft] = useState<string>("");
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showFileList, setShowFileList] = useState(true);
  const [askOpen, setAskOpen] = useState(false);
  const [askSelection, setAskSelection] = useState("");
  const [askQuestion, setAskQuestion] = useState("");
  const [askAnswer, setAskAnswer] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askPos, setAskPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const summaryHtml = useMemo(() => {
    if (!summaryText) return "";
    const raw = marked.parse(summaryText, { breaks: true }) as string;
    return DOMPurify.sanitize(raw);
  }, [summaryText]);

  function handleSummaryContextMenu(event: React.MouseEvent) {
    if (isEditingSummary || summaryLoading) {
      return;
    }
    const selection = window.getSelection()?.toString().trim() || "";
    if (!selection) {
      return;
    }
    event.preventDefault();
    const range = window.getSelection()?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();
    const x = Math.min((rect?.left ?? event.clientX) + window.scrollX, window.innerWidth - 360);
    const y = (rect?.bottom ?? event.clientY) + window.scrollY + 8;
    setAskPos({ x: Math.max(12, x), y });
    setAskSelection(selection);
    setAskQuestion("");
    setAskAnswer("");
    setAskOpen(true);
  }

  async function handleAskSubmit() {
    if (!askSelection || !askQuestion) {
      setStatus("请先选中文本并输入问题");
      return;
    }
    setAskLoading(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: askSelection, question: askQuestion })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "提问失败");
      }
      setAskAnswer(json.data.answer);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "提问失败");
    } finally {
      setAskLoading(false);
    }
  }

  const totalSize = useMemo(() => files.reduce((acc, file) => acc + file.size_bytes, 0), [files]);

  async function loadFiles() {
    const res = await fetch("/api/files", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "加载文件失败");
    }
    setFiles(json.data);
    const current = json.data.find((file: FileItem) => file.id === summaryFileId);
    if (current && current.ai_summary && !summaryText) {
      setSummaryText(current.ai_summary);
      setSummaryDraft(current.ai_summary);
      setSummaryFileName(current.original_name);
    }
  }

  useEffect(() => {
    loadFiles().catch((e: Error) => setStatus(e.message));
  }, []);

  async function handleUpload(fileOverride?: File | null) {
    const fileToUpload = fileOverride || selectedFile;

    if (!fileToUpload) {
      setStatus("请先选择一个文件");
      return;
    }

    if (!isPdfFile(fileToUpload)) {
      setStatus("仅支持上传 PDF 文件");
      return;
    }

    setBusy(true);
    setStatus("正在上传 PDF...");

    try {
      const formData = new FormData();
      formData.append("file", fileToUpload);

      const res = await fetch("/api/files", {
        method: "POST",
        body: formData
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "上传失败");
      }

      setSelectedFile(null);
      const input = document.getElementById("file-input") as HTMLInputElement | null;
      if (input) input.value = "";

      await loadFiles();
      if (json?.data?.id && json?.data?.original_name) {
        await handlePreview(json.data.id, json.data.original_name);
      }
      setStatus("上传成功");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setStatus("正在删除...");

    try {
      const res = await fetch(`/api/files/${id}`, {
        method: "DELETE"
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "删除失败");
      }

      if (previewFileId === id) {
        setPreviewUrl("");
        setPreviewFileId("");
        setPreviewFileName("");
        setFullPreviewOpen(false);
      }

      if (summaryFileId === id) {
        setSummaryFileId("");
        setSummaryFileName("");
        setSummaryText("");
      }

      await loadFiles();
      setStatus("删除成功");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(id: string) {
    setBusy(true);

    try {
      const res = await fetch(`/api/files/${id}/download`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "下载链接生成失败");
      }

      window.open(json.data.url, "_blank", "noopener,noreferrer");
      setStatus("下载链接已生成");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "下载失败");
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview(id: string, fileName: string, existingSummary?: string | null) {
    setBusy(true);

    try {
      const res = await fetch(`/api/files/${id}/view-url`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "预览链接生成失败");
      }

      setPreviewUrl(json.data.url);
      setPreviewFileId(id);
      setPreviewFileName(fileName);
      setSummaryFileId(id);
      if (existingSummary) {
        setSummaryText(existingSummary);
        setSummaryDraft(existingSummary);
        setSummaryFileName(fileName);
        setIsEditingSummary(false);
      } else {
        setSummaryText("");
        setSummaryDraft("");
        setSummaryFileName("");
        setIsEditingSummary(false);
      }
      setShowFileList(false);
      setStatus(`正在预览：${fileName}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "预览失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleSummary(id: string, fileName: string, existingSummary?: string | null) {
    if (existingSummary) {
      setSummaryFileId(id);
      setSummaryFileName(fileName);
      setSummaryText(existingSummary);
      setSummaryDraft(existingSummary);
      setIsEditingSummary(false);
      setStatus("已加载已存摘要");
      return;
    }

    setBusy(true);
    setSummaryLoading(true);
    setStatus("正在生成 AI 摘要...");

    try {
      const res = await fetch(`/api/files/${id}/summary`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "摘要生成失败");
      }

      setSummaryFileId(id);
      setSummaryFileName(fileName);
      setSummaryText(json.data.summary);
      setSummaryDraft(json.data.summary);
      setIsEditingSummary(false);
      setStatus("摘要生成成功");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "摘要生成失败");
    } finally {
      setBusy(false);
      setSummaryLoading(false);
    }
  }

  const hasFiles = files.length > 0;

  return (
    <main>
      <h1>PDF 上传与文件管理</h1>
      <p>仅支持 PDF 文件。支持上传、预览阅读、下载、删除和 AI 摘要。</p>

      {!hasFiles ? (
        <section className="empty-state">
          <div className="card upload-card-large">
            <h2>上传 PDF</h2>
            <p className="tip">首次上传后将进入阅读页面。</p>
            <div className="row">
              <input
                id="file-input"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={busy}
              />
              <button onClick={() => handleUpload()} disabled={busy || !selectedFile}>
                上传
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="topbar">
            <div className="row topbar-left">
              <button
                className="secondary"
                onClick={() => {
                  const input = document.getElementById("file-input-inline") as HTMLInputElement | null;
                  input?.click();
                }}
              >
                上传新文件
              </button>
              <button className="secondary" onClick={() => setShowFileList((prev) => !prev)}>
                文件列表
              </button>
              <div className="current-file">
                <span className="label">当前文件</span>
                <span className="value">{previewFileName || "未选择"}</span>
              </div>
            </div>
            <div className="row topbar-right">
              <span className="status-pill">{summaryLoading ? "AI 生成中" : summaryText ? "已生成摘要" : "未生成摘要"}</span>
            </div>
          </section>

          <input
            id="file-input-inline"
            className="hidden-input"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              if (file) {
                handleUpload(file);
              }
            }}
            disabled={busy}
          />

          {showFileList ? (
            <section className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>文件列表</h2>
                <p style={{ margin: 0 }}>
                  共 {files.length} 个文件，合计 {bytesToReadable(totalSize)}
                </p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>类型</th>
                    <th>大小</th>
                    <th>上传时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td className="file-name" title={file.original_name}>
                        {file.original_name}
                      </td>
                      <td>{file.mime_type || "未知"}</td>
                      <td>{bytesToReadable(file.size_bytes)}</td>
                      <td>{new Date(file.created_at).toLocaleString("zh-CN")}</td>
                      <td>
                        <div className="actions">
                          <button className="secondary" disabled={busy} onClick={() => handlePreview(file.id, file.original_name, file.ai_summary)}>
                            阅读
                          </button>
                          <button className="secondary" disabled={busy} onClick={() => handleDownload(file.id)}>
                            下载
                          </button>
                          <button className="danger" disabled={busy} onClick={() => handleDelete(file.id)}>
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {previewFileId ? (
            summaryText ? (
              <section className="reader-grid">
                <section className="card reader-left">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <h2 style={{ margin: 0 }}>{`PDF 阅读：${previewFileName}`}</h2>
                    <div className="actions">
                      <button className="secondary" onClick={() => setFullPreviewOpen(true)}>
                        全屏阅读
                      </button>
                    </div>
                  </div>
                  <div className="panel-content">
                    <iframe title="pdf-preview" src={previewUrl} className="pdf-frame" />
                  </div>
                </section>

                <section className="card reader-right">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <h2 style={{ marginTop: 0 }}>AI 摘要：{summaryFileName}</h2>
                    <div className="actions">
                      <button className="secondary" onClick={() => setIsEditingSummary((prev) => !prev)}>
                        {isEditingSummary ? "预览" : "编辑"}
                      </button>
                      {isEditingSummary ? (
                        <button
                          className="secondary"
                          onClick={() => {
                            if (!summaryFileId) {
                              setStatus("请先选择一个摘要来源文件");
                              return;
                            }
                            fetch(`/api/files/${summaryFileId}/summary`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ summary: summaryDraft })
                            })
                              .then((res) => res.json())
                              .then((json) => {
                                if (!json?.data?.ai_summary && json?.error) {
                                  throw new Error(json.error);
                                }
                                setSummaryText(summaryDraft);
                                setIsEditingSummary(false);
                                setStatus("摘要已保存");
                              })
                              .catch((e) => setStatus(e instanceof Error ? e.message : "摘要保存失败"));
                          }}
                        >
                          应用修改
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="panel-content">
                    {summaryLoading ? (
                      <div className="summary-loading">
                        <div className="dots" />
                        <p>AI 生成中，请稍后...</p>
                      </div>
                    ) : isEditingSummary ? (
                      <textarea
                        className="summary-editor"
                        value={summaryDraft}
                        onChange={(e) => setSummaryDraft(e.target.value)}
                      />
                    ) : (
                      <div
                        className="markdown-body"
                        onContextMenu={handleSummaryContextMenu}
                        dangerouslySetInnerHTML={{ __html: summaryHtml }}
                      />
                    )}
                  </div>
                </section>
              </section>
            ) : (
              <section className="card reader-single">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h2 style={{ margin: 0 }}>{`PDF 阅读：${previewFileName}`}</h2>
                  <div className="actions">
                    <button className="secondary" onClick={() => setFullPreviewOpen(true)}>
                      全屏阅读
                    </button>
                  </div>
                </div>
                <div className="panel-content">
                  <iframe title="pdf-preview" src={previewUrl} className="pdf-frame" />
                </div>
                <div className="summary-cta">
                  <button
                    className="secondary"
                    disabled={busy || !previewFileId}
                    onClick={() => handleSummary(previewFileId, previewFileName, files.find((f) => f.id === previewFileId)?.ai_summary)}
                  >
                    点击生成 AI 摘要
                  </button>
                  {summaryLoading ? <span className="tip">AI 生成中，请稍后...</span> : null}
                </div>
              </section>
            )
          ) : (
            <section className="empty-state">
              <p className="tip">请先从文件列表中选择一个文件。</p>
            </section>
          )}
        </>
      )}

      {status ? <p className="status">状态：{status}</p> : null}

      {fullPreviewOpen && previewUrl ? (
        <section className="overlay">
          <div className="overlay-card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>全屏阅读：{previewFileName}</h2>
              <button className="secondary" onClick={() => setFullPreviewOpen(false)}>
                退出全屏
              </button>
            </div>
            <iframe title="pdf-preview-fullscreen" src={previewUrl} className="pdf-frame-full" />
          </div>
        </section>
      ) : null}

      {askOpen ? (
        <>
          <div className="ask-backdrop" onClick={() => setAskOpen(false)} />
          <div className="ask-popover" style={{ top: askPos.y, left: askPos.x }}>
            <div className="row ask-popover-header">
              <strong>提问选中文本</strong>
              <button className="secondary" onClick={() => setAskOpen(false)}>
                关闭
              </button>
            </div>
            <div className="ask-selection">{askSelection}</div>
            <textarea
              className="summary-editor ask-input"
              placeholder="输入你的问题"
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
            />
            <div className="row">
              <button className="secondary" disabled={askLoading} onClick={handleAskSubmit}>
                提问
              </button>
              {askLoading ? <span className="tip">AI 正在回答...</span> : null}
            </div>
            {askAnswer ? <div className="markdown-body">{askAnswer}</div> : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
