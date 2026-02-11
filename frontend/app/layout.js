import { Geist, Geist_Mono } from "next/font/google";
import Providers from "../components/Providers";
import PerfVitalsClient from "../components/PerfVitalsClient";
import "antd/dist/reset.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: { default: "JobFinder", template: "%s | JobFinder" },
  description: "Find internships and hire talent"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        {/* Enable RUM logs by setting NEXT_PUBLIC_RUM=1 in env */}
        <PerfVitalsClient />
      </body>
    </html>
  );
}
