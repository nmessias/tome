/** Validate browser-supplied origins for settings mutations. */
export function hasSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Older e-ink browsers may omit Origin.
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

export function mayManageCache(req: Request, isAdmin: boolean, authEnabled: boolean): boolean {
  return (!authEnabled || isAdmin) && hasSameOrigin(req);
}
