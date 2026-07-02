import type { NextConfig } from "next";
import { execSync } from "child_process";

function getGitVersion(): string {
  try {
    const count = execSync("git rev-list --count HEAD", { encoding: "utf8" }).trim();
    return `1.0.${count}`;
  } catch {
    return "1.0.0";
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pinimg.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: getGitVersion(),
  },
  async rewrites() {
    return [
      {
        source: "/api/proxy/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
