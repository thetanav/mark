import type React from "react";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      {children}
    </div>
  );
}
