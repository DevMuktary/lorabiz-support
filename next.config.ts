import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Changed to /(.*) to ensure the CSP applies to all paths loaded inside the iframe
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            // Added localhost, subdomains, and Railway app for staging/dev compatibility
            value: "frame-ancestors 'self' http://localhost:* https://lorabiz.com https://*.lorabiz.com https://*.railway.app;", 
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
