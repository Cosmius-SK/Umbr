import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Em | Project Umbr",
  description: "Embr, known as Em.",
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
