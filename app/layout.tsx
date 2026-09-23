import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./editorial-overrides.css";
import SiteNav from "./ui/site-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PostCraft AI | LinkedIn Content Studio",
  description: "PostCraft is an AI editorial studio for discovering, writing and publishing thoughtful LinkedIn content. Powered by Ninety6 AI Solutions.",
  applicationName: "PostCraft AI",
  metadataBase: new URL("https://www.ninety6ai.online"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
