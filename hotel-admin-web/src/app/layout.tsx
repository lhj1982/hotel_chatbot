import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hotel Admin",
  description: "Hotel AI Admin Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
