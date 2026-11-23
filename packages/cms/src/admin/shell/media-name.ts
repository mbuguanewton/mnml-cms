/** The readable part of a stored file's key: uploaded names carry a random prefix (or a folder), which the admin hides. */
export const mediaName = (key: string) => (key.split('/').pop() ?? key).replace(/^[0-9a-f]{8}-/, '');
