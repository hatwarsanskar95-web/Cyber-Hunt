import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CYBER HUNT — Hunt the Threat. Defend the AI. Secure the Future.",
  description:
    "Real-time sandboxed multi-agent AI cybersecurity arena (CYBER-02)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased selection:bg-redTeam/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}

