/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // resvg ships a precompiled native addon. Keep it in the server runtime
    // instead of asking Webpack to parse the .node binary as JavaScript.
    serverComponentsExternalPackages: ['@resvg/resvg-js', 'ffmpeg-static'],
    // Local workspace installs hoist to the monorepo root; the linked Vercel
    // project may install under packages/api. Trace either layout.
    outputFileTracingIncludes: {
      '/api/**/*': [
        '../../node_modules/ffmpeg-static/ffmpeg',
        './node_modules/ffmpeg-static/ffmpeg',
        'node_modules/ffmpeg-static/ffmpeg',
      ],
    },
  },
  webpack: (config, { isServer }) => {
    // Exclude native modules from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }
    }

    // Ignore native modules
    config.externals = config.externals || []
    config.externals.push({
      'fsevents': 'commonjs fsevents',
    })

    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
