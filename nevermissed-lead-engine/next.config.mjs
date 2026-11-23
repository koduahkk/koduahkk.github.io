/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server-only packages that should not be bundled.
  serverExternalPackages: ["imapflow", "mailparser", "twilio", "@photostructure/tz-lookup"],
  poweredByHeader: false,
};
export default nextConfig;
