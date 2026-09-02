const REFERRER_STORAGE_KEY = "came_from";
export function getReturnUrl(): string {
  try {
    return sessionStorage.getItem(REFERRER_STORAGE_KEY) || "/";
  } catch {
    return "/";
  }
}

export function clearReturnUrl(): void {
  try {
    sessionStorage.removeItem(REFERRER_STORAGE_KEY);
  } catch {}
}
