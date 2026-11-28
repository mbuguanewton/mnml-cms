-- The table for src/mnml/postgres-assistant-store.ts: one row per question the assistant answered. Append only: it is the
-- record of what the assistant did. Run it with `pnpm db:assistant`.
create table if not exists mnml_assistant_turns (
  id bigint generated always as identity primary key,
  chat_id text not null,
  -- 'posts/hello', 'settings/' for a singleton, or 'site' away from an entry
  page text not null,
  at timestamptz not null,
  question text not null,
  answer text not null,
  -- done, stopped or error
  status text not null,
  model text,
  -- every tool it called, with its input
  tools jsonb,
  -- what it put in the form: fields, before and after values, what was dropped
  fills jsonb,
  usage jsonb,
  duration_ms int,
  -- who asked: your own column, filled from your session in `record` (the package does not know your login)
  by text
);
create index if not exists mnml_assistant_turns_page_idx on mnml_assistant_turns (page, at desc);
create index if not exists mnml_assistant_turns_chat_idx on mnml_assistant_turns (chat_id);
