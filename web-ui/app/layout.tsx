import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import AdScript from "./AdScript";
import DisableDevtool from "./DisableDevtool";
import { Providers } from "../components/Providers";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://tidal-dl-ng.web.app";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Tidal Downloader Web - Download Tidal Music in Hi-Res & Atmos",
    template: "%s | Tidal Downloader Web",
  },
  description:
    "Download music from Tidal in Hi-Res FLAC, MQA, and Dolby Atmos quality. Free web-based Tidal downloader with no software installation required. Supports tracks, albums, and playlists.",
  keywords: [
    "Tidal downloader",
    "download Tidal music",
    "Tidal FLAC download",
    "Hi-Res music download",
    "Dolby Atmos music",
    "Tidal HiFi downloader",
    "lossless music download",
    "Tidal web downloader",
    "MQA download",
    "Tidal album downloader",
    "Tidal playlist downloader",
  ],
  authors: [{ name: "Tidal Downloader Web" }],
  category: "Music",
  openGraph: {
    title: "Tidal Downloader Web - Download Tidal Music in Hi-Res & Atmos",
    description:
      "Download music from Tidal in Hi-Res FLAC, MQA, and Dolby Atmos quality. Free web-based downloader — no installation required.",
    url: BASE_URL,
    siteName: "Tidal Downloader Web",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Tidal Downloader Web - Download Tidal Music in Hi-Res & Atmos",
    description:
      "Download music from Tidal in Hi-Res FLAC, MQA, and Dolby Atmos quality. Free web-based downloader — no installation required.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <AdScript />
      </head>
      <body
        className={`${roboto.variable} antialiased bg-background text-on-background`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
               if ('serviceWorker' in navigator) {
                 navigator.serviceWorker.getRegistrations().then(function(registrations) {
                   for(let registration of registrations) {
                     registration.unregister();
                     console.log('ServiceWorker unregistered:', registration);
                   }
                 });
               }
             `
          }}
        />
        <DisableDevtool />
        <Providers>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "Tidal Downloader Web",
                url: BASE_URL,
                description:
                  "Download music from Tidal in Hi-Res FLAC, MQA, and Dolby Atmos quality. Free web-based Tidal downloader with no software installation required.",
                applicationCategory: "MultimediaApplication",
                operatingSystem: "Any",
                browserRequirements: "Requires a modern web browser",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "USD",
                },
                featureList: [
                  "Hi-Res FLAC downloads",
                  "Dolby Atmos support",
                  "Album and playlist downloads",
                  "No installation required",
                  "Browser-based",
                ],
              }),
            }}
          />
          {children}
        </Providers>
      </body>
    </html>
  );
}
