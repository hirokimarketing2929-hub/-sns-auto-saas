import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発(dev)と本番ミラー(dev:prod)を同時に起動できるよう、ビルドディレクトリを
  // 環境変数で切り替える。next dev は distDir 単位でロックを取るため、別ディレクトリに
  // すれば 3000(dev) と 3001(dev:prod) を並行起動できる。
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
