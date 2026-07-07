"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { MediaDropApp } from "./media-drop-app";

export function MediaDropClient() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <MediaDropApp />
    </QueryClientProvider>
  );
}
