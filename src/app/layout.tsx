import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wa-replay · Your conversations, revisited",
  description: "A local home for your WhatsApp memories. Browse exported conversations, photos, and moments by day.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
