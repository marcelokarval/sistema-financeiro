import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getHtmlLang, normalizeLocale } from "@/i18n/config";
import { AppIntlProvider, NextRouterRefreshBridge } from "@/i18n/provider";
import type { AppMessages } from "@/i18n/types";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
    icons: {
      icon: "/logo.svg",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rawLocale = await getLocale();
  const locale = normalizeLocale(rawLocale);
  const messages = await getMessages();

  return (
    <html lang={getHtmlLang(locale)} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NextRouterRefreshBridge>
            <AppIntlProvider locale={locale} messages={messages as AppMessages}>
              {children}
              <Toaster position="top-right" richColors closeButton />
            </AppIntlProvider>
          </NextRouterRefreshBridge>
        </ThemeProvider>
      </body>
    </html>
  );
}
