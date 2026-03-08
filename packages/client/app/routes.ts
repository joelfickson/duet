import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("join/:sessionId", "routes/join.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
