create table if not exists public.ai_agent_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique,

  agents_enabled boolean not null default false,

  agent1_enabled boolean not null default false,
  agent1_channels text[] not null default array['email','linkedin'],
  agent1_min_confidence double precision not null default 0.80,

  agent2_enabled boolean not null default false,
  agent2_channels text[] not null default array['email','linkedin'],

  agent3_enabled boolean not null default false,
  agent3_channels text[] not null default array['email'],
  agent3_mode text not null default 'draft'
    check (agent3_mode in ('off','draft','assisted','auto')),

  allow_sdr_manage_agents boolean not null default false,
  allow_sdr_manage_agent3 boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_agent_settings enable row level security;

create policy "ai_agent_settings_admin_only"
on public.ai_agent_settings
for all using (
  has_role(auth.uid(), 'admin')
);

