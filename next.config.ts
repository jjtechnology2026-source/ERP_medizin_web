import type { NextConfig } from "next";
import { readFileSync } from "fs";

function getAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
    return pkg.version;
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
    NEXT_PUBLIC_APP_VERSION: getAppVersion(),
  },
};

export default nextConfig;
