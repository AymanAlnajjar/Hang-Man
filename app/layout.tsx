import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "المشنقة — لعبة الحروف",
  description: "لعبة المشنقة العربية للعب بين شخصين عن بُعد",
  // Lets iOS open it full-screen when added to the home screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "المشنقة",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // stops iOS from zooming when tapping fast / focusing inputs
  themeColor: "#0f0a1e",
  viewportFit: "cover", // draw under the notch; safe-area padding handles the rest
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-dvh font-cairo text-white antialiased">
        {children}
      </body>
    </html>
  );
}
