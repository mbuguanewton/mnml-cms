export async function uploadImage(apiPath: string, file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${apiPath}/upload`, { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`);
  return json.url;
}
