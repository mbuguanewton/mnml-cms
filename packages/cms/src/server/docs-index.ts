// Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file.

export type DocsPage = { title: string; url: string; description: string; headings: string[]; skill: string };

export const DOCS_SITE = "https://mnml-cms.vercel.app";

export const docsIndex: DocsPage[] = [
  {
    "title": "mnml-cms",
    "url": "https://mnml-cms.vercel.app",
    "description": "A small schema-driven CMS that lives inside your Next.js site.",
    "headings": [],
    "skill": "mnml-getting-started"
  },
  {
    "title": "Getting started",
    "url": "https://mnml-cms.vercel.app/getting-started",
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
    ],
    "skill": "mnml-getting-started"
  },
  {
    "title": "Field types",
    "url": "https://mnml-cms.vercel.app/fields",
    "description": "Every field type in mnml.config.ts, its options and the value readers return.",
    "headings": [
      "Picking entries",
      "Groups become tabs"
    ],
    "skill": "mnml-fields"
  },
  {
    "title": "Limits",
    "url": "https://mnml-cms.vercel.app/fields/limits",
    "description": "min and max on array, blocks and references fields.",
    "headings": [],
    "skill": "mnml-fields"
  },
  {
    "title": "Blocks",
    "url": "https://mnml-cms.vercel.app/fields/blocks",
    "description": "Pages made of different kinds of sections with fields.blocks() and block().",
    "headings": [
      "In the admin",
      "Reading"
    ],
    "skill": "mnml-fields"
  },
  {
    "title": "Select labels",
    "url": "https://mnml-cms.vercel.app/fields/select-labels",
    "description": "Show labels in the admin for select values, and read them with selectLabel().",
    "headings": [],
    "skill": "mnml-fields"
  },
  {
    "title": "Dates and times",
    "url": "https://mnml-cms.vercel.app/fields/dates-and-times",
    "description": "The date and datetime fields: storage, time zones and sorting.",
    "headings": [],
    "skill": "mnml-fields"
  },
  {
    "title": "Focal point",
    "url": "https://mnml-cms.vercel.app/fields/focal-point",
    "description": "Keep the important part of an image in frame when it's cropped (focalX, focalY, focalPosition).",
    "headings": [
      "In the admin",
      "Stored value",
      "On your site"
    ],
    "skill": "mnml-fields"
  },
  {
    "title": "Default values",
    "url": "https://mnml-cms.vercel.app/fields/default-values",
    "description": "Starting values for new entries, items and blocks with default.",
    "headings": [],
    "skill": "mnml-fields"
  },
  {
    "title": "Conditional fields",
    "url": "https://mnml-cms.vercel.app/fields/conditional-fields",
    "description": "Show a field only when other fields match, with showIf.",
    "headings": [
      "Conditions",
      "Hidden fields"
    ],
    "skill": "mnml-fields"
  },
  {
    "title": "Derived values",
    "url": "https://mnml-cms.vercel.app/fields/derived-values",
    "description": "Read-only values computed from an entry's fields (derive, readingTime, plainText).",
    "headings": [],
    "skill": "mnml-fields"
  },
  {
    "title": "SEO",
    "url": "https://mnml-cms.vercel.app/fields/seo",
    "description": "The seo() field and seoMetadata() for Next.js metadata.",
    "headings": [],
    "skill": "mnml-fields"
  },
  {
    "title": "Reading content",
    "url": "https://mnml-cms.vercel.app/reading-content",
    "description": "Read content on your pages: getSingleton, listEntries, getEntry, getEntries, listSlugs, RichText and live preview.",
    "headings": [
      "A list page and a post page",
      "`listEntries` options",
      "`getEntries`",
      "Live preview"
    ],
    "skill": "mnml-reading-content"
  },
  {
    "title": "Drafts and publishing",
    "url": "https://mnml-cms.vercel.app/drafts-and-publishing",
    "description": "Drafts, autosave, Publish, Discard changes and Unpublish, and what the site shows for each.",
    "headings": [
      "Autosave",
      "Only valid data is saved",
      "Someone else edited it",
      "On your site",
      "Singletons"
    ],
    "skill": "mnml-drafts"
  },
  {
    "title": "Moving content between databases",
    "url": "https://mnml-cms.vercel.app/moving-content",
    "description": "Export and import content between databases, rehost images and convert Markdown, with @n3wtou/mnml-cms/sync.",
    "headings": [
      "Choosing the databases",
      "Modes",
      "Safety",
      "What moves",
      "In your own scripts",
      "Markdown content",
      "Rehosting images"
    ],
    "skill": "mnml-moving-content"
  },
  {
    "title": "Extending the editor",
    "url": "https://mnml-cms.vercel.app/editor",
    "description": "Extend the rich text editor with Tiptap extensions and toolbar tools (defineEditor, editorProvider).",
    "headings": [
      "Ready-made tools",
      "Your own tools",
      "Toolbar groups",
      "Example: code blocks with syntax highlighting"
    ],
    "skill": "mnml-editor"
  },
  {
    "title": "Tables",
    "url": "https://mnml-cms.vercel.app/editor/tables",
    "description": "Tables in rich text with @n3wtou/mnml-cms/table.",
    "headings": [
      "In the editor",
      "On your site",
      "Your own floating tools"
    ],
    "skill": "mnml-editor"
  },
  {
    "title": "Nodes with a form",
    "url": "https://mnml-cms.vercel.app/editor/nodes-with-a-form",
    "description": "Custom rich text nodes edited through a form (tools.node, nodeAttributes).",
    "headings": [
      "1. Define the node",
      "2. Add the button",
      "Form fields",
      "Dialogs in any tool"
    ],
    "skill": "mnml-editor"
  },
  {
    "title": "Linking entries from rich text",
    "url": "https://mnml-cms.vercel.app/editor/linking-entries",
    "description": "Link to other entries from rich text with the reference tool and referenceNode.",
    "headings": [
      "On your site"
    ],
    "skill": "mnml-editor"
  },
  {
    "title": "Custom node rendering",
    "url": "https://mnml-cms.vercel.app/editor/custom-rendering",
    "description": "Render rich text nodes with your own React components on the site.",
    "headings": [
      "For every `<RichText>`",
      "For one `<RichText>`",
      "Good to know"
    ],
    "skill": "mnml-editor"
  },
  {
    "title": "Agents (MCP)",
    "url": "https://mnml-cms.vercel.app/agents",
    "description": "Let AI agents (Claude Code, Cursor, Zed) manage content through the built-in MCP server, with scoped tokens, drafts and editor approval.",
    "headings": [
      "Set up",
      "Tokens",
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
    ],
    "skill": "mnml-agents"
  },
  {
    "title": "Options",
    "url": "https://mnml-cms.vercel.app/options",
    "description": "Every option of createCms: storage, auth, media, paths, sidebar, editor, MCP, revalidate and onChange.",
    "headings": [
      "In your own code"
    ],
    "skill": "mnml-setup"
  },
  {
    "title": "Authentication",
    "url": "https://mnml-cms.vercel.app/authentication",
    "description": "The built-in password login, or your own auth (Better Auth, Auth.js, Clerk) through an AuthAdapter.",
    "headings": [
      "Built-in login",
      "Your own login"
    ],
    "skill": "mnml-setup"
  },
  {
    "title": "Image storage",
    "url": "https://mnml-cms.vercel.app/image-storage",
    "description": "Where uploaded images are stored: local disk in development, Vercel Blob, or your own storage.",
    "headings": [
      "The Media screen",
      "Adapters"
    ],
    "skill": "mnml-setup"
  },
  {
    "title": "Other ORMs",
    "url": "https://mnml-cms.vercel.app/other-orms",
    "description": "Store entries without Drizzle by writing your own EntryStorage (Prisma, Kysely, SQL).",
    "headings": [
      "The table",
      "Example: Prisma"
    ],
    "skill": "mnml-setup"
  },
  {
    "title": "Entry points",
    "url": "https://mnml-cms.vercel.app/entry-points",
    "description": "Every import path of @n3wtou/mnml-cms and what it contains.",
    "headings": [],
    "skill": "mnml-getting-started"
  },
  {
    "title": "Common mistakes",
    "url": "https://mnml-cms.vercel.app/common-mistakes",
    "description": "The mistakes that cost the most time with mnml-cms, and how to avoid them.",
    "headings": [
      "Imports",
      "Values",
      "Blocks and conditional fields",
      "Drafts",
      "Routes and layout",
      "After upgrading the package"
    ],
    "skill": "mnml-getting-started"
  },
  {
    "title": "Upgrading",
    "url": "https://mnml-cms.vercel.app/upgrading",
    "description": "What each mnml-cms version added, what broke, and the steps to upgrade an older site.",
    "headings": [
      "Versions",
      "Upgrade steps",
      "What a project has"
    ],
    "skill": "mnml-upgrading"
  }
];
