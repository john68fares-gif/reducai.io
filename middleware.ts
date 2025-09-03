// middleware.ts
export const config = {
  matcher: ['/builder/:path*'], // protect only builder area if you must
};
export function middleware() {
  return Response.next(); // or remove middleware entirely
}
