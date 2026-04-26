import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { TopBar } from "@/components/TopBar";
import { initQueueSync } from "@/store/sync";

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="text-center">
        <div className="text-7xl font-semibold tracking-tighter">404</div>
        <p className="mt-3 text-sm text-muted-foreground">This page doesn't exist.</p>
        <a href="/" className="inline-block mt-6 text-xs border border-border rounded-md px-4 h-9 leading-9">Go home</a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SADOO — AI Bank Call Center" },
      { name: "description", content: "Real-time AI-powered call center platform for SADOO bank operators." },
      { property: "og:title", content: "SADOO — AI Bank Call Center" },
      { name: "twitter:title", content: "SADOO — AI Bank Call Center" },
      { property: "og:description", content: "Real-time AI-powered call center platform for SADOO bank operators." },
      { name: "twitter:description", content: "Real-time AI-powered call center platform for SADOO bank operators." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/95f1e6ce-aa4c-49f7-8df3-2a6b8d52cc62/id-preview-0b8b2187--e752defc-30b4-4b97-8639-4128d5721617.lovable.app-1777180704155.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/95f1e6ce-aa4c-49f7-8df3-2a6b8d52cc62/id-preview-0b8b2187--e752defc-30b4-4b97-8639-4128d5721617.lovable.app-1777180704155.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  useEffect(() => { initQueueSync(); }, []);
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body className="grain min-h-screen">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
