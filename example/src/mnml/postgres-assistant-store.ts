// The assistant's record in Postgres, as an example of the `store` option of `assistant()`: copy it and change what you
// need. `record` adds one row per question (table: scripts/assistant.sql). With `{ turns: true }` the History menu reads
// the chats back from the table (shared between editors and devices, and without "Delete"); without it the panel keeps
// its chat list in the browser and this table is only the audit record.
//
//   assistant({ model, store: postgresAssistantStore(process.env.DATABASE_URL, { turns: true }) })
import { neon } from '@neondatabase/serverless';
import type { AssistantStore, AssistantTurn } from '@n3wtou/mnml-cms/ai';

export function postgresAssistantStore(url: string | undefined, { turns = false }: { turns?: boolean } = {}): AssistantStore {
  // Created when first used, so a build without DATABASE_URL still works.
  const db = () => neon(url ?? '');
  return {
    // `request` is the editor's request: read your own session from it to fill a `by` column (who asked).
    async record(t) {
      await db()`
        insert into mnml_assistant_turns (chat_id, page, at, question, answer, status, model, tools, fills, usage, duration_ms)
        values (${t.chatId}, ${t.page}, ${t.at}, ${t.question}, ${t.answer}, ${t.status}, ${t.model ?? null},
          ${JSON.stringify(t.tools ?? [])}::jsonb, ${JSON.stringify(t.fills ?? [])}::jsonb, ${JSON.stringify(t.usage ?? null)}::jsonb, ${t.durationMs ?? null})`;
    },
    ...(turns && {
      async turns(page: string): Promise<AssistantTurn[]> {
        const rows = await db()`
          select chat_id, page, at, question, answer, status, model, tools, fills, usage, duration_ms
          from mnml_assistant_turns where page = ${page} order by at desc limit 300`;
        return rows.map((r) => ({
          chatId: r.chat_id,
          page: r.page,
          at: new Date(r.at).toISOString(),
          question: r.question,
          answer: r.answer,
          status: r.status,
          fills: r.fills,
          tools: r.tools,
          model: r.model ?? undefined,
          usage: r.usage ?? undefined,
          durationMs: r.duration_ms ?? undefined,
        }));
      },
    }),
  };
}
