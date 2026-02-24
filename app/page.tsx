"use client";

import { useEffect, useMemo, useState } from "react";

type FileItem = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

function bytesToReadable(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function HomePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const totalSize = useMemo(() => files.reduce((acc, file) => acc + file.size_bytes, 0), [files]);

  async function loadFiles() {
    const res = await fetch("/api/files", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "加载文件失败");
    }
    setFiles(json.data);
  }

  useEffect(() => {
    loadFiles().catch((e: Error) => setStatus(e.message));
  }, []);

  async function handleUpload() {
    if (!selectedFile) {
      setStatus("请先选择一个文件");
      return;
    }

    setBusy(true);
    setStatus("正在上传...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

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

  return (
    <main>
      <h1>文档上传与文件管理</h1>
      <p>后端由 Next.js API 路由对接 Supabase，统一管理上传、列表、删除和下载。</p>

      <section className="card">
        <h2>上传文件</h2>
        <div className="row">
          <input
            id="file-input"
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            disabled={busy}
          />
          <button onClick={handleUpload} disabled={busy || !selectedFile}>
            上传
          </button>
        </div>
      </section>

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

      {status ? <p className="status">状态：{status}</p> : null}
    </main>
  );
}
