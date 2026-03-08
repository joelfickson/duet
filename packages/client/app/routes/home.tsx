import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Duet" },
    { name: "description", content: "Collaborative AI sessions" },
  ];
}

export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-5xl font-display font-semibold text-white tracking-tight">
          Duet
        </h1>
        <p className="mt-3 text-lg text-silver">Collaborative AI sessions</p>
      </div>
    </main>
  );
}
