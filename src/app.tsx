import { RouterProvider } from "@tanstack/react-router";
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { router } from "./utils/routes";

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

export default function App() {
  const zoomRef = useRef(1);

  useEffect(() => {
    const storedZoom = Number(localStorage.getItem("app-zoom") ?? "1");
    const initialZoom = Number.isFinite(storedZoom)
      ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, storedZoom))
      : 1;

    zoomRef.current = initialZoom;
    window.electronAPI?.zoom?.setFactor(initialZoom);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;

      const isZoomIn = event.key === "+" || event.key === "=";
      const isZoomOut = event.key === "-" || event.key === "_";
      const isReset = event.key === "0";

      if (!isZoomIn && !isZoomOut && !isReset) return;

      event.preventDefault();

      const nextZoom = isReset
        ? 1
        : isZoomIn
          ? Math.min(MAX_ZOOM, zoomRef.current + ZOOM_STEP)
          : Math.max(MIN_ZOOM, zoomRef.current - ZOOM_STEP);

      zoomRef.current = nextZoom;
      localStorage.setItem("app-zoom", String(nextZoom));
      window.electronAPI?.zoom?.setFactor(nextZoom);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}

const container = document.getElementById("app");
if (!container) {
  throw new Error('Root element with id "app" not found');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
