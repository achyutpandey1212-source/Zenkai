export function getPublicAppOrigin(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

  if (configuredUrl) {
    return new URL(configuredUrl).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return new URL(`${forwardedProto}://${forwardedHost}`).origin;
  }

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    return new URL(originHeader).origin;
  }

  return new URL(request.url).origin;
}