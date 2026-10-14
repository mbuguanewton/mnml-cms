import { collection, config, derive, fields, readingTime, singleton } from '@n3wtou/mnml-cms';

export default config({
  settings: singleton({
    label: 'Settings',
    preview: '/',
    fields: {
      name: fields.text('Site name', { required: true }),
      tagline: fields.text('Tagline'),
      footer: fields.group('Footer', {
        note: fields.text('Note', { help: 'Shown next to the copyright line.' }),
        links: fields.array(
          'Links',
          { label: fields.text('Label', { required: true }), url: fields.url('URL', { required: true }) },
          { itemLabel: 'label' },
        ),
      }),
    },
    derived: {
      copyright: derive((s) => `© ${new Date().getFullYear()} ${s.name}`, { after: 'footer' }),
    },
  }),
  home: singleton({
    label: 'Home page',
    preview: '/',
    fields: {
      hero: fields.group('Hero', {
        eyebrow: fields.text('Eyebrow'),
        headline: fields.text('Headline'),
        intro: fields.textarea('Intro'),
        ctaLabel: fields.text('Button label'),
        ctaUrl: fields.url('Button link', { help: 'A full URL. Leave empty to link to all posts.' }),
        image: fields.image('Image', { help: 'Optional. Wide images work best.' }),
      }),
      featuredPost: fields.reference('Featured post', 'posts', { help: 'Shown large under the hero.' }),
      postCount: fields.number('Latest posts to show', { min: 1, max: 12, step: 1 }),
      seo: fields.seo(),
    },
  }),
  authors: collection({
    label: 'Authors',
    titleField: 'name',
    basePath: '/authors',
    preview: true,
    fields: {
      name: fields.text('Name', { required: true }),
      role: fields.text('Role'),
      bio: fields.textarea('Bio'),
      photo: fields.image('Photo'),
    },
  }),
  posts: collection({
    label: 'Posts',
    titleField: 'title',
    basePath: '/posts',
    preview: true,
    fields: {
      title: fields.text('Title', { required: true }),
      summary: fields.textarea('Summary'),
      date: fields.date('Date'),
      category: fields.select('Category', ['news', 'guide', 'opinion'] as const),
      author: fields.reference('Author', 'authors'),
      cover: fields.image('Cover image'),
      content: fields.richtext('Content'),
      seo: fields.seo(),
    },
    // Worked out on every read; never stored or edited.
    derived: {
      readingTime: derive((p) => readingTime(p.content), { after: 'content' }),
    },
  }),
});
