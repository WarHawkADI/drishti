import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Drishti — The Agentic AI Loan Officer",
  description:
    "Sees. Understands. Decides. In 5 minutes. A video-native agentic AI system for end-to-end digital loan origination, built for Poonawalla Fincorp's Loan Wizard vision.",
  keywords: [
    "agentic AI",
    "loan origination",
    "Poonawalla Fincorp",
    "TenzorX 2026",
    "Drishti",
    "RBI",
  ],
  authors: [{ name: "Team IIITDards" }],
  openGraph: {
    title: "Drishti — Sees. Understands. Decides. In 5 minutes.",
    description:
      "Agentic AI loan officer. Video-native. RBI-native. Built for Poonawalla Fincorp.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B0B2B",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-ink text-indigo-light antialiased font-sans">
        <div className="aurora" aria-hidden />
        {children}
      </body>
    </html>
  );
}
