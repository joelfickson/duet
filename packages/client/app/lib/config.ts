export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  wsUrl: import.meta.env.VITE_WS_URL ?? "ws://localhost:8000",
} as const;
