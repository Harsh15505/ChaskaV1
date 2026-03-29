/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',       // Required for Capacitor — builds to out/
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,    // Required for static export
  },
}

export default nextConfig
