-- 1) 创建文件元数据表
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  original_name text not null,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_path text not null unique,
  ai_summary text,
  created_at timestamptz not null default now()
);

-- 2) 建立索引，优化列表排序
create index if not exists files_created_at_idx on public.files (created_at desc);

-- 3) 启用 RLS（该项目通过 Next.js 服务端 API 使用 service_role 访问）
alter table public.files enable row level security;
