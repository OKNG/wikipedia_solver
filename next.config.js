/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['upload.wikimedia.org'],
  },
}

module.exports = nextConfig 