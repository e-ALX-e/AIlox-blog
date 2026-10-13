import 'server-only'

// Repository-managed additions for this site, not default administrators for forks.
// SITE_URL is normalized to its origin by parseServerEnv. Never use a request Host
// header, redirect URL, client-supplied email, or a substring/domain-only match here.
const additionalAdminsByOrigin = new Map<string, readonly string[]>([
  ['https://www.mikuflare.com', ['3612996124@qq.com']],
  ['https://mikuflare.com', ['3612996124@qq.com']],
])

export function isSiteAdminEmail(siteOrigin: string, email: string): boolean {
  return additionalAdminsByOrigin.get(siteOrigin)?.includes(email.toLowerCase()) ?? false
}
