import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ["latin"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Tidal Downloader Web",
  description: "Next Generation Downloader for Tidal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://pl28650855.effectivegatecpm.com/5d/3f/6c/5d3f6cd061b197396c5d98f803d627a2.js"></script>
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
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.jsdelivr.net/npm/disable-devtool@latest" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof DisableDevtool !== 'undefined') {
                // Skip disable-devtool on localhost for development
                var isLocalhost = window.location.hostname === 'localhost' || 
                                  window.location.hostname === '127.0.0.1' ||
                                  window.location.hostname === '0.0.0.0';
                if (!isLocalhost) {
                  DisableDevtool({
                    url: window.location.href,
                    disableMenu: true,
                    clearLog: true,
                    disableSelect: false,
                    disableCopy: false,
                    disableCut: false,
                    disablePaste: false
                  });
                }
              }
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
