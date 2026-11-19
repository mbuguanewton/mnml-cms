import nextra from 'nextra';

const withNextra = nextra({
  // One dark theme for code in light and dark mode, to match the dark code frame.
  mdxOptions: { rehypePrettyCodeOptions: { theme: { light: 'one-dark-pro', dark: 'one-dark-pro' } } },
});

export default withNextra({});
