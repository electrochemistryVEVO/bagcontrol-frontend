import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.56.1','3.91.199.44'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
