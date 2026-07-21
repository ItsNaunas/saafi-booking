import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAAFI Cleaning Service — book your home clean",
  description:
    "Family-run cleaning service. Get an instant quote and book your home clean in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
