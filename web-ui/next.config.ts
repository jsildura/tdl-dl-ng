import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for Cloudflare Pages
  output: 'export',

  // Disable source maps in production to protect codebase
  productionBrowserSourceMaps: false,

  // Remove X-Powered-By header for security
  poweredByHeader: false,

  // Disable image optimization (not supported on static export)
  images: {
    unoptimized: true,
  },

  // Transpile ESM-only packages
  transpilePackages: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],

  // Disable linting during build to avoid memory issues
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },

  // Configure for WebAssembly (ffmpeg.wasm)
  webpack: (config) => {
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Add WASM file handling
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    return config;
  },

  // Note: Headers for SharedArrayBuffer are set via Cloudflare Pages _headers file
  // Static export does not support the headers() function
};

export default nextConfig;
