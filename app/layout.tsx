import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DNS Reachability Tester",
  description: "Test reachability of ad and tracking domains from your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
