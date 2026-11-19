export function apiSessionHeaders(role?: string): Record<string, string> {
  const query = new URLSearchParams(window.location.search);
  const adminRoute = ['/admin', '/owner'].includes(window.location.pathname) ||
    window.location.pathname.startsWith('/admin/') || query.get('portal') === 'admin' ||
    ['admin', 'owner'].includes(query.get('page') || '') || ['#admin', '#owner'].includes(window.location.hash);
  const token = role === 'admin' || (!role && adminRoute)
    ? sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token')
    : localStorage.getItem('mentora_user_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
