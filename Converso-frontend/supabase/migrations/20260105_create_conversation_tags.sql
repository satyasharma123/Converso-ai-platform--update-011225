create table if not exists public.conversation_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  channel text not null check (channel in ('email','linkedin','whatsapp','instagram')),
  tag text null check (tag in ('meeting_requested','info_requested','lead')),
  source text not null check (source in ('ai','manual')),
  confidence double precision null,
  evidence_text text null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, conversation_id)
);

create index if not exists idx_conversation_tags_conversation
on public.conversation_tags(conversation_id);

create index if not exists idx_conversation_tags_workspace
on public.conversation_tags(workspace_id);

alter table public.conversation_tags enable row level security;

create policy "conversation_tags_admin_select"
on public.conversation_tags
for select using (
  has_role(auth.uid(), 'admin')
);

create policy "conversation_tags_sdr_select"
on public.conversation_tags
for select using (
  has_role(auth.uid(), 'sdr')
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
    and c.assigned_to = auth.uid()
  )
);

