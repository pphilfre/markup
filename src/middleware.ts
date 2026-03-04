import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  middlewareAuth: {
    enabled: false,
    unauthenticatedPaths: ["/(.*)"], // All paths allowed unauthenticated
  },
});

export const config = {
  matcher: [
    // Match all paths except static files and internals
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-touch-icon.png|site.webmanifest|og-image.png).*)",
  ],
};
