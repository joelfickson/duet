import { useParams } from "react-router";

export default function Session() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-charcoal/30 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-white">Duet</h1>
        <span className="font-mono text-sm text-silver/50">{sessionId}</span>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-silver/50">Session view coming soon</p>
      </main>
    </div>
  );
}
