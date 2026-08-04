import type { Metadata, Viewport } from "next";
import { Alexandria, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

// Headings: geometric, editorial. UI/game text: highly legible in interfaces.
const heading = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});
const body = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ألعاب الكلمات",
  description:
    "منصة ألعاب كلمات عربية للعب بين شخصين — المشنقة، وردل، تكوين الكلمات، والمزيد",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ألعاب الكلمات",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // stops iOS from zooming when focusing inputs
  themeColor: "#f7f1e6",
  viewportFit: "cover", // draw under the notch; safe-area padding handles the rest
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${heading.variable} ${body.variable}`}
    >
      <body className="min-h-dvh font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
