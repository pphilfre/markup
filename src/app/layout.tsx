import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://markup-editor.vercel.app";
const SITE_NAME = "Markup";
const IS_DEV = process.env.NODE_ENV === "development";
const SITE_DESCRIPTION =
  "A fast, keyboard-first markdown editor built for speed. Write, preview, and export markdown with split view, syntax highlighting, spotlight search, and a distraction-free interface.";

export const metadata: Metadata = {
  // ── Core ──────────────────────────────────────────────────────────────
  title: {
    default: "Markup — Fast, Keyboard-First Markdown Editor",
    template: "%s | Markup",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [
    "markdown editor",
    "markdown",
    "editor",
    "writing tool",
    "note taking",
    "keyboard shortcuts",
    "split view",
    "live preview",
    "markdown preview",
    "syntax highlighting",
    "distraction free writing",
    "web editor",
    "markdown export",
    "open source editor",
    "developer tools",
    "productivity",
    "writing app",
    "code editor",
    "markup language",
    "markdown writer",
  ],
  authors: [
    { name: "Freddie Philpot", url: "https://freddiephilpot.dev" },
  ],
  creator: "Freddie Philpot",
  publisher: "Freddie Philpot",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  category: "Productivity",

  // ── Open Graph ────────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Markup — Fast, Keyboard-First Markdown Editor",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Markup — A fast markdown editor with split-view, live preview, and keyboard shortcuts",
        type: "image/png",
      },
    ],
  },

  // ── Twitter / X ───────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: "Markup — Fast, Keyboard-First Markdown Editor",
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
    creator: "@pphilfre",
  },

  // ── Robots ────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Icons ─────────────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },

  // ── App-specific ──────────────────────────────────────────────────────
  manifest: IS_DEV ? undefined : "/site.webmanifest",

  // ── Misc ──────────────────────────────────────────────────────────────
  other: {
    "msapplication-TileColor": "#0a0a0a",
    "theme-color": "#0a0a0a",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Markup",
    "mobile-web-app-capable": "yes",
    "format-detection": "telephone=no",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Markup",
              url: SITE_URL,
              description: SITE_DESCRIPTION,
              applicationCategory: "Productivity",
              operatingSystem: "Any",
              browserRequirements: "Requires a modern web browser",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Person",
                name: "Freddie Philpot",
                url: "https://freddiephilpot.dev",
              },
              featureList: [
                "Keyboard-first markdown editing",
                "Live split-view preview",
                "Syntax highlighting",
                "Spotlight search",
                "File and folder organization",
                "Export to .md and .zip",
                "Dark and light themes",
                "Customizable editor settings",
                "Mobile responsive design",
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen overflow-hidden`}
      >
        <ConvexClientProvider>
          <TooltipProvider delayDuration={300}>
            {children}
          </TooltipProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
