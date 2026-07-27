import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Allow the widget to be embedded in iframes on any domain
        source: "/widget",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://lorabiz.com;", // Change '*' to specific domains (e.g., 'https://yourwebsite.com') in production for better security
          },
        ],
      },
      {
        // Allow external sites to make POST requests to your support APIs
        source: "/api/support/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      }
    ];
  },
};

export default nextConfig;
