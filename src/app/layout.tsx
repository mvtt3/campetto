import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Intro, introScript } from "@/components/intro";
import { Providers } from "@/components/providers";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Campetto",
  description: "Partite, statistiche e classifiche del nostro campetto",
  applicationName: "Campetto",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Campetto",
    statusBarStyle: "default",
  },
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
  // Niente zoom: l'app si usa come un'app, con le dimensioni già pensate per il telefono.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
    { media: "(prefers-color-scheme: light)", color: "#f2e8d5" },
  ],
};

// Android, app installata: alcuni telefoni (es. Samsung) disegnano la pagina anche sotto la
// barra di stato e sotto i tasti di sistema, ma dicono che lo spazio sicuro è 0: la parte alta e
// la barra dell'app finiscono coperte. Se la pagina arriva fino in fondo allo schermo, in basso si
// lascia l'altezza dei tasti (48 px); se occupa tutto lo schermo, anche in alto si lascia quella
// della barra di stato (26 px). Negli altri casi vale quello che dice il telefono.
const safeAreaScript = `(function(){try{if(!/Android/i.test(navigator.userAgent))return;var m=window.matchMedia('(display-mode: standalone),(display-mode: fullscreen),(display-mode: minimal-ui)');var r=document.documentElement;function probe(p){var d=document.createElement('div');d.style.cssText='position:fixed;left:0;top:0;width:1px;height:env('+p+',0px);visibility:hidden;pointer-events:none';r.appendChild(d);var h=d.getBoundingClientRect().height;d.remove();return h;}function f(){r.style.removeProperty('--sab');r.style.removeProperty('--sat');if(!m.matches)return;var gap=screen.height-window.innerHeight;if(probe('safe-area-inset-bottom')<1&&gap<40)r.style.setProperty('--sab','48px');if(probe('safe-area-inset-top')<1&&gap<12)r.style.setProperty('--sat','26px');}f();window.addEventListener('resize',f);m.addEventListener&&m.addEventListener('change',f);}catch(e){}})();`;

// Applica il tema prima del primo disegno, così non c'è il lampo di colore sbagliato.
const themeScript = `(function(){try{var t=localStorage.getItem('campetto:theme')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      className={dmSans.variable}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: safeAreaScript }} />
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
