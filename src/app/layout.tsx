import type { Metadata, Viewport } from "next";
import { Archivo, Ultra } from "next/font/google";
import "./globals.css";
import { Intro, introScript } from "@/components/intro";
import { Providers } from "@/components/providers";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

// Slab grosso da poster anni '30: titoli e numeri.
const ultra = Ultra({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-ultra",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Campetto",
  description: "Partite, statistiche e classifiche del nostro campetto",
  applicationName: "Campetto",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Campetto", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
    { media: "(prefers-color-scheme: light)", color: "#f2e8d5" },
  ],
};

// Applica il tema prima del primo disegno, così non c'è il lampo di colore sbagliato.
const themeScript = `(function(){try{var t=localStorage.getItem('campetto:theme')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${archivo.variable} ${ultra.variable}`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body>
        <Providers>
          <Intro />
          {children}
        </Providers>
      </body>
    </html>
  );
}
