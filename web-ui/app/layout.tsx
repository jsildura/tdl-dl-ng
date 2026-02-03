import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ["latin"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Tidal DL NGWeb Interface",
  description: "Next Generation Downloader for Tidal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
        {children}
      </body>
    </html>
  );
}
