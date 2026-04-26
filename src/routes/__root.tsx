import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { TopBar } from "@/components/TopBar";

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
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: () => (
    <>
      <TopBar />
      <Outlet />
    </>
  ),
  notFoundComponent: NotFound,
});

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
