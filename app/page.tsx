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
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  const loadingSteps = useMemo(
    () => ["Extracting PDF text", "Analyzing context", "Generating summary", "Formatting output"],
    []
  );

  const summaryHtml = useMemo(() => {
    if (!summaryText) return "";
    const raw = marked.parse(summaryText, { breaks: true }) as string;
    return DOMPurify.sanitize(raw);
  }, [summaryText]);

  const totalSize = useMemo(() => files.reduce((acc, file) => acc + file.size_bytes, 0), [files]);

  useEffect(() => {
    if (!summaryLoading) {
      setLoadingStepIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % loadingSteps.length);
    }, 1100);
    return () => clearInterval(timer);
  }, [summaryLoading, loadingSteps.length]);

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
      setStatus("Please select text and enter a question.");
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
        throw new Error(json.error || "Question failed.");
      }
      setAskAnswer(json.data.answer);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Question failed.");
    } finally {
      setAskLoading(false);
    }
  }

  async function loadFiles() {
    const res = await fetch("/api/files", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Failed to load files.");
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
      setStatus("Please select a file first.");
      return;
    }

    if (!isPdfFile(fileToUpload)) {
      setStatus("Only PDF files are allowed.");
      return;
    }

    setBusy(true);
    setStatus("Uploading PDF...");

    try {
      const formData = new FormData();
      formData.append("file", fileToUpload);

      const res = await fetch("/api/files", {
        method: "POST",
        body: formData
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Upload failed.");
      }

      setSelectedFile(null);
      const input = document.getElementById("file-input") as HTMLInputElement | null;
      if (input) input.value = "";

      await loadFiles();
      if (json?.data?.id && json?.data?.original_name) {
        await handlePreview(json.data.id, json.data.original_name);
      }
      setStatus("Upload completed.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const target = files.find((file) => file.id === id);
    const confirmed = window.confirm(
      `Are you sure you want to delete this file?\n\n${target?.original_name || id}`
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setStatus("Deleting...");

    try {
      const res = await fetch(`/api/files/${id}`, {
        method: "DELETE"
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Delete failed.");
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
      setStatus("Delete successful.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(id: string) {
    setBusy(true);

    try {
      const res = await fetch(`/api/files/${id}/download`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to generate download link.");
      }

      window.open(json.data.url, "_blank", "noopener,noreferrer");
      setStatus("Download link generated.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview(id: string, fileName: string, existingSummary?: string | null) {
    setBusy(true);

    try {
      const res = await fetch(`/api/files/${id}/view-url`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to generate preview link.");
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
      setStatus(`Previewing: ${fileName}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Preview failed.");
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
      setStatus("Loaded saved summary.");
      return;
    }

    setBusy(true);
    setSummaryLoading(true);
    setStatus("Generating AI summary...");

    try {
      const res = await fetch(`/api/files/${id}/summary`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Summary generation failed.");
      }

      setSummaryFileId(id);
      setSummaryFileName(fileName);
      setSummaryText(json.data.summary);
      setSummaryDraft(json.data.summary);
      setIsEditingSummary(false);
      setStatus("Summary generated.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Summary generation failed.");
    } finally {
      setBusy(false);
      setSummaryLoading(false);
    }
  }

  const hasFiles = files.length > 0;

  return (
    <main>
      <h1>PDF Upload & File Manager</h1>
      <p>PDF only. Upload, preview, download, delete, and AI summary.</p>

      {!hasFiles ? (
        <section className="empty-state">
          <div className="card upload-card-large">
            <h2>Upload PDF</h2>
            <p className="tip">After first upload, the reader view opens automatically.</p>
            <div className="row">
              <input
                id="file-input"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={busy}
              />
              <button onClick={() => handleUpload()} disabled={busy || !selectedFile}>
                Upload
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
                Upload New File
              </button>
              <button className="secondary" onClick={() => setShowFileList((prev) => !prev)}>
                File List
              </button>
              <div className="current-file">
                <span className="label">Current File</span>
                <span className="value">{previewFileName || "None selected"}</span>
              </div>
            </div>
            <div className="row topbar-right">
              <span className="status-pill">{summaryLoading ? "AI generating" : summaryText ? "Summary ready" : "No summary yet"}</span>
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
                <h2 style={{ margin: 0 }}>Files</h2>
                <p style={{ margin: 0 }}>
                  {files.length} files, total {bytesToReadable(totalSize)}
                </p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Uploaded At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td className="file-name" title={file.original_name}>
                        {file.original_name}
                      </td>
                      <td>{bytesToReadable(file.size_bytes)}</td>
                      <td>{new Date(file.created_at).toLocaleString("en-US")}</td>
                      <td>
                        <div className="actions">
                          <button className="secondary" disabled={busy} onClick={() => handlePreview(file.id, file.original_name, file.ai_summary)}>
                            Open
                          </button>
                          <button className="secondary" disabled={busy} onClick={() => handleDownload(file.id)}>
                            Download
                          </button>
                          <button className="danger" disabled={busy} onClick={() => handleDelete(file.id)}>
                            Delete
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
                    <h2 style={{ margin: 0 }}>{`PDF Reader: ${previewFileName}`}</h2>
                    <div className="actions">
                      <button className="secondary" onClick={() => setFullPreviewOpen(true)}>
                        Fullscreen
                      </button>
                    </div>
                  </div>
                  <div className="panel-content">
                    <iframe title="pdf-preview" src={previewUrl} className="pdf-frame" />
                  </div>
                </section>

                <section className="card reader-right">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <h2 style={{ marginTop: 0 }}>AI Summary: {summaryFileName}</h2>
                    <div className="actions">
                      <button className="secondary" onClick={() => setIsEditingSummary((prev) => !prev)}>
                        {isEditingSummary ? "Preview" : "Edit"}
                      </button>
                      {isEditingSummary ? (
                        <button
                          className="secondary"
                          onClick={() => {
                            if (!summaryFileId) {
                              setStatus("Please select a source file first.");
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
                                setStatus("Summary saved.");
                              })
                              .catch((e) => setStatus(e instanceof Error ? e.message : "Failed to save summary."));
                          }}
                        >
                          Apply
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="panel-content">
                    {summaryLoading ? (
                      <div className="summary-loading rich-loading">
                        <div className="loading-badge">AI Summary in Progress</div>
                        <div className="loading-step">{loadingSteps[loadingStepIndex]}</div>
                        <div className="loading-bar-track">
                          <div className="loading-bar-fill" />
                        </div>
                        <div className="loading-subtle">This usually takes a few seconds.</div>
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
                  <h2 style={{ margin: 0 }}>{`PDF Reader: ${previewFileName}`}</h2>
                  <div className="actions">
                    <button className="secondary" onClick={() => setFullPreviewOpen(true)}>
                      Fullscreen
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
                    Generate AI Summary
                  </button>
                  {summaryLoading ? (
                    <div className="inline-loading">
                      <div className="mini-dots" />
                      <span className="tip">{loadingSteps[loadingStepIndex]}...</span>
                    </div>
                  ) : null}
                </div>
              </section>
            )
          ) : (
            <section className="empty-state">
              <p className="tip">Select a file from the list first.</p>
            </section>
          )}
        </>
      )}

      {status ? <p className="status">Status: {status}</p> : null}

      {fullPreviewOpen && previewUrl ? (
        <section className="overlay">
          <div className="overlay-card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>Fullscreen Reader: {previewFileName}</h2>
              <button className="secondary" onClick={() => setFullPreviewOpen(false)}>
                Exit Fullscreen
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
              <strong>Ask About Selected Text</strong>
              <button className="secondary" onClick={() => setAskOpen(false)}>
                Close
              </button>
            </div>
            <div className="ask-selection">{askSelection}</div>
            <textarea
              className="summary-editor ask-input"
              placeholder="Type your question"
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
            />
            <div className="row">
              <button className="secondary" disabled={askLoading} onClick={handleAskSubmit}>
                Ask
              </button>
              {askLoading ? <span className="tip">AI is answering...</span> : null}
            </div>
            {askAnswer ? <div className="markdown-body">{askAnswer}</div> : null}
          </div>
        </>
      ) : null}

      {summaryLoading ? (
        <section className="loading-dock" aria-live="polite">
          <div className="loading-dock-card">
            <div className="loading-dock-title">Generating AI Summary</div>
            <div className="loading-dock-step">{loadingSteps[loadingStepIndex]}</div>
            <div className="loading-bar-track">
              <div className="loading-bar-fill" />
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
