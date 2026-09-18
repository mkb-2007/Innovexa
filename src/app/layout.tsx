import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FloatChat",
  description:
    "Explore real-time ARGO float telemetry, sea surface temperature anomalies, and geospatial hydrodynamic ocean data through an interactive 3D Earth powered by AI.",
  keywords: [
    "ARGO floats",
    "ocean telemetry",
    "sea surface temperature",
    "oceanography",
    "geospatial data",
    "ocean intelligence",
    "salinity",
    "deep ocean",
    "Cesium 3D",
  ],
  authors: [{ name: "FloatChat" }],
  icons: {
    icon: [
      { url: "/images/floatchat-orb.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/images/floatchat-orb.png",
    apple: "/images/floatchat-orb.png",
  },
  openGraph: {
    title: "FloatChat",
    description:
      "Interactive 3D Earth interface for exploring 3,940+ active ARGO float observations, ocean telemetry, and hydrodynamic data.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#00d2ff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.CESIUM_BASE_URL = "/cesium/";',
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

