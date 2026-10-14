import 'server-only';
import { FileTextIcon, HouseIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { createCms, neonDatabase, vercelBlobMedia } from '@n3wtou/mnml-cms/next';
import config from '../mnml.config';
import { Editor } from './mnml-editor-client';

export const cms = createCms(config, {
  database: neonDatabase(process.env.DATABASE_URL),
  auth: { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET },
  // Vercel Blob when a token is set; otherwise `next dev` falls back to local disk (./.mnml-uploads).
  media: process.env.BLOB_READ_WRITE_TOKEN ? vercelBlobMedia() : undefined,
  brand: 'Example',
  icons: { settings: <SettingsIcon />, home: <HouseIcon />, authors: <UserIcon />, posts: <FileTextIcon /> },
  editor: Editor,
});
