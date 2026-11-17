import { createFileRoute } from "@tanstack/react-router";

const respond = async (request: Request) => (await import("../../../ai/waste-photo-scanner/respond.server")).respond(request);

export const Route = createFileRoute("/api/ai/waste-photo-scanner")({
  server: { handlers: { GET: ({ request }) => respond(request), POST: ({ request }) => respond(request), DELETE: ({ request }) => respond(request) } },
});
