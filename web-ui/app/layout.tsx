import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import AdScript from "./AdScript";
import DisableDevtool from "./DisableDevtool";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
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
        {children}
      </body>
    </html>
  );
}
