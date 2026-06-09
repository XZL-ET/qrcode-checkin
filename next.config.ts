import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Docker 部署时 trust proxy（如 Nginx 反代需要）
  poweredByHeader: false,
};

export default nextConfig;
