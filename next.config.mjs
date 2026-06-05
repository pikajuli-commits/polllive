/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required when using custom server.js
  // Socket.io handles its own WebSocket upgrade
  webpack: (config) => {
    config.externals.push({ bufferutil: 'bufferutil', 'utf-8-validate': 'utf-8-validate' })
    return config
  },
}

export default nextConfig;
