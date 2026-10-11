import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

// Shared by the editor and the server renderer so both see the same schema.
// StarterKit v3 already bundles Link.
export const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https', protocols: ['mailto'] },
  }),
  Image,
];
