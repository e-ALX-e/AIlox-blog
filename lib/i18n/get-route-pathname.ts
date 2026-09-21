export function getRoutePathname(pathname: string) {
  const routePathname = pathname.replace(/^\/(?:zh|en|zh-tw|ja|ru|de)(?=\/|$)/, '')

  return routePathname === '' ? '/' : routePathname
}
