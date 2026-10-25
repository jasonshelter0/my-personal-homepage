/** Render draft assets through the authenticated editor route without changing
 * the public paths stored in Markdown, snapshots or copied to the clipboard. */
export function editorMediaUrl(url: string | undefined): string | undefined {
  return url?.startsWith('/media/') ? `/admin${url}` : url;
}
