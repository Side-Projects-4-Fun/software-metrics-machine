import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import { ThemeProvider } from "./ThemeProvider";
import { MetricCatalogProvider } from '@/components/providers/MetricCatalogProvider';
import { getMetricCatalog } from '@/server/metric-catalog';
import type { MetricCatalogEntry } from '@/lib/metrics/metric-catalog';
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
  title: "Software Metrics Machine",
  description: "A data-driven approach to high-performing teams",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let catalog: MetricCatalogEntry[] = [];

  try {
    catalog = await getMetricCatalog();
  } catch (error) {
    // Tooltips and references degrade gracefully when the API is unreachable.
    console.error('Error fetching metric catalog:', error);
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppRouterCacheProvider>
          <MetricCatalogProvider entries={catalog}>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </MetricCatalogProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
