import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import "../styles.css";
import "../app.css";

// Link previews read the Open Graph and X tags below; og:title and og:description repeat the page's own title and description.
const title = "EnviroTrap Nexus — From collection to characterization to action";
const description = "A research workspace for UIUC campus waste: import collection records, map sources, run waste audits and export evidence-based research summaries.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { name: "author", content: "Foundable" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@joinfoundable" },
    ],
    links: [
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300..800&family=IBM+Plex+Sans:wdth,wght@75..100,300..700&display=swap" },
      { rel: "icon", href: "/generated-assets/company-logo.png", type: "image/png" },
    ],
  }),
  component: WebsiteDocument,
  notFoundComponent: () => (
    <main className="not-found">
      <h1>Page not found</h1>
      <Link to="/">Return home</Link>
    </main>
  ),
});

function WebsiteDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
