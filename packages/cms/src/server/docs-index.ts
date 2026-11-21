// Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file.

export type DocsPage = { title: string; url: string; markdown: string; description: string; headings: string[] };

export const DOCS_SITE = "https://mnml-cms.vercel.app";

export const docsIndex: DocsPage[] = [
  {
    "title": "mnml-cms",
    "url": "https://mnml-cms.vercel.app",
    "markdown": "https://mnml-cms.vercel.app/index.md",
    "description": "A small schema-driven CMS that lives inside your Next.js site.",
    "headings": []
  },
  {
    "title": "Getting started",
    "url": "https://mnml-cms.vercel.app/getting-started",
    "markdown": "https://mnml-cms.vercel.app/getting-started.md",
    "description": "Install mnml-cms in a Next.js site: the config, createCms, the admin and API routes, the proxy and the database table.",
    "headings": [
      "Install",
      "Environment variables",
      "1. Define your content",
      "2. Create the CMS",
      "3. Mount the admin",
      "4. Add the styles",
      "5. Create the table",
      "Help your AI agent"
    ]
  },
  {
    "title": "Field types",
    "url": "https://mnml-cms.vercel.app/fields",
    "markdown": "https://mnml-cms.vercel.app/fields.md",
    "description": "Every field type in mnml.config.ts, its options and the value readers return.",
    "headings": [
      "Picking entries",
      "Groups become tabs"
    ]
  },
  {
    "title": "Limits",
    "url": "https://mnml-cms.vercel.app/fields/limits",
    "markdown": "https://mnml-cms.vercel.app/fields/limits.md",
    "description": "min and max on array, blocks and references fields.",
    "headings": []
  },
  {
    "title": "Blocks",
    "url": "https://mnml-cms.vercel.app/fields/blocks",
    "markdown": "https://mnml-cms.vercel.app/fields/blocks.md",
    "description": "Pages made of different kinds of sections with fields.blocks() and block().",
    "headings": [
      "In the admin",
      "Reading"
    ]
  },
  {
    "title": "Select labels",
    "url": "https://mnml-cms.vercel.app/fields/select-labels",
    "markdown": "https://mnml-cms.vercel.app/fields/select-labels.md",
    "description": "Show labels in the admin for select values, and read them with selectLabel().",
    "headings": []
  },
  {
    "title": "Dates and times",
    "url": "https://mnml-cms.vercel.app/fields/dates-and-times",
    "markdown": "https://mnml-cms.vercel.app/fields/dates-and-times.md",
    "description": "The date and datetime fields: storage, time zones and sorting.",
    "headings": []
  },
  {
    "title": "Focal point",
    "url": "https://mnml-cms.vercel.app/fields/focal-point",
    "markdown": "https://mnml-cms.vercel.app/fields/focal-point.md",
    "description": "Keep the important part of an image in frame when it's cropped (focalX, focalY, focalPosition).",
    "headings": [
      "In the admin",
      "Stored value",
      "On your site"
    ]
  },
  {
    "title": "Default values",
    "url": "https://mnml-cms.vercel.app/fields/default-values",
    "markdown": "https://mnml-cms.vercel.app/fields/default-values.md",
    "description": "Starting values for new entries, items and blocks with default.",
    "headings": []
  },
  {
    "title": "Conditional fields",
    "url": "https://mnml-cms.vercel.app/fields/conditional-fields",
    "markdown": "https://mnml-cms.vercel.app/fields/conditional-fields.md",
    "description": "Show a field only when other fields match, with showIf.",
    "headings": [
      "Conditions",
      "Hidden fields"
    ]
  },
  {
    "title": "Derived values",
    "url": "https://mnml-cms.vercel.app/fields/derived-values",
    "markdown": "https://mnml-cms.vercel.app/fields/derived-values.md",
    "description": "Read-only values computed from an entry's fields (derive, readingTime, plainText).",
    "headings": []
  },
  {
    "title": "SEO",
    "url": "https://mnml-cms.vercel.app/fields/seo",
    "markdown": "https://mnml-cms.vercel.app/fields/seo.md",
    "description": "The seo() field and seoMetadata() for Next.js metadata.",
    "headings": []
  },
  {
    "title": "Reading content",
    "url": "https://mnml-cms.vercel.app/reading-content",
    "markdown": "https://mnml-cms.vercel.app/reading-content.md",
    "description": "Read content on your pages: getSingleton, listEntries, getEntry, getEntries, listSlugs, RichText and live preview.",
    "headings": [
      "A list page and a post page",
      "`listEntries` options",
      "`getEntries`",
      "Live preview"
    ]
  },
  {
    "title": "Drafts and publishing",
    "url": "https://mnml-cms.vercel.app/drafts-and-publishing",
    "markdown": "https://mnml-cms.vercel.app/drafts-and-publishing.md",
    "description": "Drafts, autosave, Publish, Discard changes and Unpublish, and what the site shows for each.",
    "headings": [
      "Collection list",
      "Autosave",
      "Only valid data is saved",
      "Someone else edited it",
      "On your site",
      "Singletons"
    ]
  },
  {
    "title": "Moving content between databases",
    "url": "https://mnml-cms.vercel.app/moving-content",
    "markdown": "https://mnml-cms.vercel.app/moving-content.md",
    "description": "Export and import content between databases, rehost images and convert Markdown, with @n3wtou/mnml-cms/sync.",
    "headings": [
      "Choosing the databases",
      "Modes",
      "Safety",
      "What moves",
      "In your own scripts",
      "Markdown content",
      "Rehosting images"
    ]
  },
  {
    "title": "Extending the editor",
    "url": "https://mnml-cms.vercel.app/editor",
    "markdown": "https://mnml-cms.vercel.app/editor.md",
    "description": "Extend the rich text editor with Tiptap extensions and toolbar tools (defineEditor, editorProvider).",
    "headings": [
      "Ready-made tools",
      "Your own tools",
      "Toolbar groups",
      "Narrow fields and fullscreen",
      "Example: code blocks with syntax highlighting"
    ]
  },
  {
    "title": "Tables",
    "url": "https://mnml-cms.vercel.app/editor/tables",
    "markdown": "https://mnml-cms.vercel.app/editor/tables.md",
    "description": "Tables in rich text with @n3wtou/mnml-cms/table.",
    "headings": [
      "In the editor",
      "On your site",
      "Your own floating tools"
    ]
  },
  {
    "title": "Nodes with a form",
    "url": "https://mnml-cms.vercel.app/editor/nodes-with-a-form",
    "markdown": "https://mnml-cms.vercel.app/editor/nodes-with-a-form.md",
    "description": "Custom rich text nodes edited through a form (tools.node, nodeAttributes).",
    "headings": [
      "1. Define the node",
      "2. Add the button",
      "Form fields",
      "Dialogs in any tool"
    ]
  },
  {
    "title": "Linking entries from rich text",
    "url": "https://mnml-cms.vercel.app/editor/linking-entries",
    "markdown": "https://mnml-cms.vercel.app/editor/linking-entries.md",
    "description": "Link to other entries from rich text with the reference tool and referenceNode.",
    "headings": [
      "On your site"
    ]
  },
  {
    "title": "Custom node rendering",
    "url": "https://mnml-cms.vercel.app/editor/custom-rendering",
    "markdown": "https://mnml-cms.vercel.app/editor/custom-rendering.md",
    "description": "Render rich text nodes with your own React components on the site.",
    "headings": [
      "For every `<RichText>`",
      "For one `<RichText>`",
      "Good to know"
    ]
  },
  {
    "title": "Agents (MCP)",
    "url": "https://mnml-cms.vercel.app/agents",
    "markdown": "https://mnml-cms.vercel.app/agents.md",
    "description": "Let AI agents (Claude Code, Cursor, Zed) manage content through the built-in MCP server, with scoped tokens, drafts and editor approval.",
    "headings": [
      "Set up",
      "Tokens",
      "Tokens from the admin",
      "Scopes",
      "Tools",
      "Rich text",
      "Drafts",
      "Approval",
      "Connect an agent",
      "Claude Code",
      "Zed",
      "Cursor",
      "Claude connectors",
      "Security"
    ]
  },
  {
    "title": "Options",
    "url": "https://mnml-cms.vercel.app/options",
    "markdown": "https://mnml-cms.vercel.app/options.md",
    "description": "Every option of createCms: storage, auth, media, paths, sidebar, editor, MCP, revalidate and onChange.",
    "headings": [
      "In your own code",
      "Admin UI components"
    ]
  },
  {
    "title": "Authentication",
    "url": "https://mnml-cms.vercel.app/authentication",
    "markdown": "https://mnml-cms.vercel.app/authentication.md",
    "description": "The built-in password login, or your own auth (Better Auth, Auth.js, Clerk) through an AuthAdapter.",
    "headings": [
      "Built-in login",
      "Your own login"
    ]
  },
  {
    "title": "Image storage",
    "url": "https://mnml-cms.vercel.app/image-storage",
    "markdown": "https://mnml-cms.vercel.app/image-storage.md",
    "description": "Where uploaded images are stored: local disk in development, Vercel Blob, or your own storage.",
    "headings": [
      "The Media screen",
      "Adapters"
    ]
  },
  {
    "title": "Other ORMs",
    "url": "https://mnml-cms.vercel.app/other-orms",
    "markdown": "https://mnml-cms.vercel.app/other-orms.md",
    "description": "Store entries without Drizzle by writing your own EntryStorage (Prisma, Kysely, SQL).",
    "headings": [
      "The table",
      "Example: Prisma"
    ]
  },
  {
    "title": "Entry points",
    "url": "https://mnml-cms.vercel.app/entry-points",
    "markdown": "https://mnml-cms.vercel.app/entry-points.md",
    "description": "Every import path of @n3wtou/mnml-cms and what it contains.",
    "headings": []
  },
  {
    "title": "Common mistakes",
    "url": "https://mnml-cms.vercel.app/common-mistakes",
    "markdown": "https://mnml-cms.vercel.app/common-mistakes.md",
    "description": "The mistakes that cost the most time with mnml-cms, and how to avoid them.",
    "headings": [
      "Imports",
      "Values",
      "Blocks and conditional fields",
      "Drafts",
      "Routes and layout",
      "After upgrading the package"
    ]
  },
  {
    "title": "Upgrading",
    "url": "https://mnml-cms.vercel.app/upgrading",
    "markdown": "https://mnml-cms.vercel.app/upgrading.md",
    "description": "What each mnml-cms version added, what broke, and the steps to upgrade an older site.",
    "headings": [
      "Versions",
      "Upgrade steps",
      "What a project has"
    ]
  }
];
