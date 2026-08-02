export function sanitizeSlug(s: string): string {
  const input = String(s ?? '');
  const deunicoded = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return deunicoded
    .toLowerCase()
    .split('')
    .map((c) => (/[a-z0-9]/i.test(c) ? c : '_'))
    .join('')
    .split('_')
    .filter((x) => x.length > 0)
    .join('_');
}

export function sanitizePathOrUrl(s: string): string {
  const input = String(s ?? '');
  const deunicoded = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return deunicoded
    .toLowerCase()
    .split('')
    .map((c) => (/[a-z0-9/_.:?&#=%+@-]/i.test(c) ? c : '_'))
    .join('')
    .split('_')
    .filter((x) => x.length > 0)
    .join('_');
}
