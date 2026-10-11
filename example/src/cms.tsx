import 'server-only';
import { FileTextIcon, SettingsIcon } from 'lucide-react';
import { createCms, neonDatabase, vercelBlobMedia } from '@newtou/mnml-cms/next';
import config from '../cms.config';

export const cms = createCms(config, {
  database: neonDatabase(process.env.DATABASE_URL),
  auth: { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET },
  media: vercelBlobMedia(),
  brand: 'Example',
  icons: { settings: <SettingsIcon />, posts: <FileTextIcon /> },
});
