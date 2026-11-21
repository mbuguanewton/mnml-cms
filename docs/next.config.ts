import nextra from 'nextra';

const withNextra = nextra({
  // One dark theme for code in light and dark mode, to match the dark code frame.
  mdxOptions: { rehypePrettyCodeOptions: { theme: { light: 'one-dark-pro', dark: 'one-dark-pro' } } },
});

export default withNextra({
  // Every page as Markdown for agents: /fields/blocks.md is served by app/md/[...path] from docs/md (generated),
  // pre-rendered at build with a text/markdown content type.
  async rewrites() {
    return { beforeFiles: [{ source: '/:path(.+)\\.md', destination: '/md/:path' }], afterFiles: [], fallback: [] };
  },
});
