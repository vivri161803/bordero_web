import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dashboard Consegne",
  description: "Dashboard operativa per la gestione delle consegne, basata su Vercel e Supabase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="dark">
      <body className={`${inter.variable} antialiased text-white`}>
        {children}
      </body>
    </html>
  );
}
