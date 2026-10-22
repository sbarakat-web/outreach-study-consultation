// Returns the visitor's country (ISO code) from Vercel's IP geolocation header.
export function GET(request: Request) {
  const country = request.headers.get("x-vercel-ip-country") ?? "";
  return new Response(JSON.stringify({ country }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
