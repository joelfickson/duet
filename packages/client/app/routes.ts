import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("join/:sessionId", "routes/join.tsx"),
  route("session/:sessionId", "routes/session.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
