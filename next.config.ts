import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
        util: false,
        buffer: false,
        process: false,
        zlib: false,
        http: false,
        https: false,
        url: false,
        assert: false,
        constants: false,
        module: false,
        vm: false,
        events: false,
        string_decoder: false,
        querystring: false,
        punycode: false,
        domain: false,
        dns: false,
        dgram: false,
        cluster: false,
        readline: false,
        repl: false,
        tty: false,
        v8: false,
        worker_threads: false,
      };
    }
    return config;
  },
  // Either use transpilePackages or serverExternalPackages but not both for the same packages
  // transpilePackages: ['pdf-parse', 'mammoth', 'tesseract.js'],
  experimental: {},
  serverExternalPackages: ['pdf-parse', 'mammoth', 'tesseract.js']
};

export default nextConfig;
