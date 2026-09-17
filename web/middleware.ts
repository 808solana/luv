import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Brand rasters under /BRAND_ASSETS are painted as CSS backgrounds. Block
 * navigating to those URLs as a document so “Open image in new tab” /
 * address-bar paste does not serve the file. Image/CSS fetches
 * (sec-fetch-dest: image) still succeed.
 */
export function middleware(request: NextRequest) {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest === "document") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/BRAND_ASSETS/models/:path*",
    "/BRAND_ASSETS/clients/:path*",
    "/BRAND_ASSETS/intelligence-index/:path*",
    "/BRAND_ASSETS/contact/:path*",
  ],
};
