/** @type {import('next').NextConfig} */
const nextConfig = {
  // unpdf (pdf.js) ships a worker script — telling webpack to treat it as
  // an asset/resource stops "can't resolve" errors in the server bundle.
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent webpack from bundling the pdf.js canvas dependency,
      // which doesn't exist in a serverless Node environment.
      config.resolve.alias.canvas = false;
    }
    return config;
  },
};

export default nextConfig;
