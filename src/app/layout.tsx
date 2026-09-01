import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { MotionProvider } from "@/components/MotionProvider";
import { CurrentProvider } from "@/components/current/CodeCurrentContext";

const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('cb-theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "Code Butler — A calmer way to build software",
  description:
    "Give Code Butler an idea. Watch an autonomous software engineer understand it, plan it, and build it — under your control at every step.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${GeistSans.className} min-h-screen bg-outer text-text-primary`}
        style={
          {
            "--font-geist": GeistSans.style.fontFamily,
            "--font-geist-mono": GeistMono.style.fontFamily,
            "--font-display": "var(--font-geist)",
          } as React.CSSProperties
        }
      >
        <AuthProvider>
          <ThemeProvider>
            <CurrentProvider>
              <MotionProvider>{children}</MotionProvider>
            </CurrentProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
