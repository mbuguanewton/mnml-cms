import { collection, config, fields, singleton } from '@n3wtou/mnml-cms';

export default config({
  settings: singleton({
    label: 'Settings',
    preview: '/',
    fields: {
      name: fields.text('Site name', { required: true }),
      tagline: fields.text('Tagline'),
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
      content: fields.richtext('Content'),
    },
  }),
});
