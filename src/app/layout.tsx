import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "MyMoney — Your finances, clearly", description: "Private income and expense tracking" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
