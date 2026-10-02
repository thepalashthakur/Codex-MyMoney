-- Apply to the Supabase project shared by UseAuth and S3Sync.
create table public.finance_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null check (length(trim(kind)) between 1 and 40),
  color text not null default '#8192b2' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  unique (user_id, id)
);
create index finance_sources_owner_idx on public.finance_sources(user_id, name);

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  name text not null check (length(trim(name)) between 1 and 80),
  color text not null default '#8192b2' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  parent_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, parent_id) references public.finance_categories(user_id, id) on delete restrict
);
create index finance_categories_owner_idx on public.finance_categories(user_id, kind, parent_id);

create function public.finance_validate_category() returns trigger language plpgsql as $$
declare ancestor uuid; ancestor_kind text; depth integer := 0;
begin
  ancestor := new.parent_id;
  while ancestor is not null loop
    if ancestor = new.id then raise exception 'Category cycle is not allowed'; end if;
    select parent_id, kind into ancestor, ancestor_kind
      from public.finance_categories where id = ancestor and user_id = new.user_id;
    if not found or ancestor_kind <> new.kind then
      raise exception 'Parent category must have the same owner and kind';
    end if;
    depth := depth + 1;
    if depth > 20 then raise exception 'Category nesting limit exceeded'; end if;
  end loop;
  return new;
end $$;
create trigger finance_category_guard before insert or update on public.finance_categories
  for each row execute function public.finance_validate_category();

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  occurred_on date not null,
  description text not null check (length(trim(description)) between 1 and 200),
  note text not null default '' check (length(note) <= 4000),
  source_id uuid,
  category_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, source_id) references public.finance_sources(user_id, id) on delete restrict,
  foreign key (user_id, category_id) references public.finance_categories(user_id, id) on delete restrict
);
create index finance_transactions_owner_date_idx on public.finance_transactions(user_id, occurred_on desc, created_at desc);
create function public.finance_validate_transaction() returns trigger language plpgsql as $$
declare category_kind text;
begin
  if new.category_id is not null then
    select kind into category_kind from public.finance_categories
      where id = new.category_id and user_id = new.user_id;
    if category_kind is distinct from new.kind then
      raise exception 'Transaction and category kinds must match';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger finance_transaction_guard before insert or update on public.finance_transactions
  for each row execute function public.finance_validate_transaction();

create table public.finance_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  file_id uuid not null,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  unique (user_id, file_id),
  foreign key (user_id, transaction_id) references public.finance_transactions(user_id, id) on delete cascade
);
create index finance_attachments_transaction_idx on public.finance_attachments(user_id, transaction_id);

alter table public.finance_sources enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_attachments enable row level security;
create policy owner_sources on public.finance_sources for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_categories on public.finance_categories for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_transactions on public.finance_transactions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy owner_attachments on public.finance_attachments for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.finance_sources, public.finance_categories, public.finance_transactions, public.finance_attachments to authenticated;
