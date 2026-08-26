/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer ships its own React reconciler; letting Next/Turbopack
  // bundle it causes a duplicate-React symbol mismatch (React error #31) when
  // rendering the management-account PDF. Keep it external so it loads in Node
  // with a single React instance.
  serverExternalPackages: ['@react-pdf/renderer'],
  // Pin the workspace root — a pnpm-workspace.yaml exists higher up (~), and
  // without this Turbopack infers the wrong root and warns about lockfiles.
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Server Actions are enabled by default in Next 16; keep body limit generous
    // for receipt uploads routed through actions.
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // Baseline security headers (§45).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
