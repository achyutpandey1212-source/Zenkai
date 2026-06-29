import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cormorant = localFont({
  src: [
    {
      path: "../../fonts/cormorant-garamound/CormorantGaramond-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/cormorant-garamound/CormorantGaramond-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/cormorant-garamound/CormorantGaramond-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../fonts/cormorant-garamound/CormorantGaramond-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../fonts/cormorant-garamound/CormorantGaramond-Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-cormorant",
});

const allura = localFont({
  src: "../../fonts/allura/Allura_Script.ttf",
  variable: "--font-allura",
});

export const metadata: Metadata = {
  title: "Zenkai — Your Luxury AI Growth Partner",
  description: "A calm, personal space to carry less load and grow into who you want to become.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${allura.variable} h-full antialiased`}
    >
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-accent/20 selection:text-foreground">
        {children}
      </body>
    </html>
  );
}
