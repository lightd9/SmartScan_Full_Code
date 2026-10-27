import deployment from '../../vercel.json';

describe('Vercel production configuration', () => {
  it('routes SPA deep links to the app entry point', () => {
    expect(deployment.rewrites).toContainEqual({
      source: '/(.*)',
      destination: '/index.html',
    });
  });

  it('sets baseline browser security headers', () => {
    const headers = new Map(deployment.headers[0].headers.map(({ key, value }) => [key, value]));
    expect(deployment.headers[0].source).toBe('/(.*)');
    expect(headers.get('Strict-Transport-Security')).toContain('max-age=');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(headers.get('Permissions-Policy')).toContain('camera=(self)');
    expect(headers.get('Permissions-Policy')).toContain('geolocation=(self)');
  });

  it('limits executable content while allowing configured HTTPS APIs and media', () => {
    const headers = new Map(deployment.headers[0].headers.map(({ key, value }) => [key, value]));
    const policy = headers.get('Content-Security-Policy');
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("connect-src 'self' https:");
    expect(policy).toContain("img-src 'self' data: blob: https:");
    expect(policy).toContain("media-src 'self' blob:");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});
