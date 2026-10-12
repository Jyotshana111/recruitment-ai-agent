import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recruitment AI · Evidence before decisions",
  description: "A local workspace for CV evidence, requirement reviews, and thoughtful interviews.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
