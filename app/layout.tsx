import type { Metadata } from "next";
import PageTabs from "@/app/shared/PageTabs";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import "./globals.css";

export const metadata: Metadata = {
  title: "Bag Control",
  description: "Panel de control para la gestión de equipajes y simulaciones",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppRouterCacheProvider>
            <PageTabs/>
            {children}
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
