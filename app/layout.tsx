import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "../components/navbar";
import { ClerkProvider } from "@clerk/nextjs";
import { ReactQueryClientProvider } from "../components/react-query-client-provider";
import CreateProfileOnSignIn from "@/components/create-profile";

export const metadata: Metadata = {
  title: "AI Meal Plans | Simple SaaS Demo",
  description: "Generate personalized meal plans with OpenAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <ReactQueryClientProvider>
          <ClerkProvider>
            <CreateProfileOnSignIn />
            <NavBar />
            {/* Main container for page content */}
            <main className="max-w-7xl mx-auto pt-16 p-4 min-h-screen">
              {children}
            </main>
          </ClerkProvider>
        </ReactQueryClientProvider>
      </body>
    </html>
  );
}
