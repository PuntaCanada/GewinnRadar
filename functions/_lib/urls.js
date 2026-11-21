export function publicContestUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value) || /%5c/i.test(value)) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443') return false;
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (!host || !host.includes('.') || host.includes('..') || host.startsWith('.') || host.endsWith('.')) return false;
    if (!/^[a-z0-9.-]+$/.test(host) || host.length > 253) return false;
    const labels = host.split('.');
    if (labels.some(part => !part || part.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part))) return false;
    if (/^(localhost|local|internal|test|invalid|example|home|lan|onion)$/.test(labels.at(-1))) return false;
    if (/^(?:\d+\.){3}\d+$/.test(host) || /^\d+(?:\.\d+){0,3}$/.test(host)) return false;
    if (u.hostname.includes(':') || u.hostname.startsWith('[')) return false;
    return true;
  } catch { return false; }
}
