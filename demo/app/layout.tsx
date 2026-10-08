import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";

import { MainNav } from "@/components/MainNav";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERP Document Generator",
  description: "Lexical editor, live Handlebars preview and Gotenberg PDF for ERP documents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex h-dvh flex-col overflow-hidden">
        <TooltipProvider>
          <header className="flex h-12 shrink-0 items-center gap-4 border-b bg-background px-4">
            <Link href="/" className="text-sm font-semibold">
              ERP Document Generator
            </Link>
            <MainNav />
          </header>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
