import type { NextConfig } from 'next';
const config: NextConfig = {
  async rewrites() {
    const backend = process.env.API_BASE_URL || 'http://127.0.0.1:8000';
    return [
      {source:'/api/:path*',destination:`${backend}/api/:path*`},
      {source:'/health/:path*',destination:`${backend}/health/:path*`},
    ];
  }
};
export default config;
