<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

# Entry points

| Import | Contents |
| --- | --- |
| `@n3wtou/mnml-cms` | Schema builders, validation, types, `seoMetadata`. Framework-free. |
| `@n3wtou/mnml-cms/next` | `createCms` (with the MCP server, see [Agents](https://mnml-cms.vercel.app/agents)), `neonDatabase`, `drizzleStorage`, `vercelBlobMedia`, `localMedia` |
| `@n3wtou/mnml-cms/proxy` | `adminProxy` |
| `@n3wtou/mnml-cms/rich-text` | `RichText` (server renderer), `collectReferences` |
| `@n3wtou/mnml-cms/editor` | `defineEditor`, `tools` (incl. `tools.node`, `tools.reference`), `nodeAttributes`, `referenceNode`, `collectReferences`, types `RichTextComponents`, `RichTextNodeProps`. Server-safe. |
| `@n3wtou/mnml-cms/table` | `tables`: table extensions and buttons. Server-safe. |
| `@n3wtou/mnml-cms/admin` | UI pieces for extra admin pages, `editorProvider` |
| `@n3wtou/mnml-cms/sync` | Export/import, `mediaImporter`, `markdownToRichText` ([Moving content](https://mnml-cms.vercel.app/moving-content)). No Next.js needed. |
| `@n3wtou/mnml-cms/db`, `@n3wtou/mnml-cms/schema` | The Drizzle table, for scripts and drizzle-kit (same export) |
| `@n3wtou/mnml-cms/styles.css` | Admin styles and the `--mnml-*` variables |
