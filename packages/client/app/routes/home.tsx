import { ArrowRight, Github, Plus, Sparkles, Users, Zap } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { useCreateSession } from "~/hooks/use-sessions";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Duet - Collaborative AI Sessions" },
    {
      name: "description",
      content:
        "Multiple participants, one shared AI context. Think together in real time.",
    },
  ];
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-charcoal/40 bg-deep-navy/60 backdrop-blur-sm">
      <CardContent className="pt-6">
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-steel/15">
          <Icon className="size-5 text-steel" />
        </div>
        <h3 className="font-display text-lg font-semibold text-cloud">
          {title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-silver/70">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

type Provider = "anthropic" | "gemini" | "openrouter";

const providerModels: Record<Provider, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-haiku-4-20250414", label: "Claude Haiku 4" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  ],
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  openrouter: [
    {
      value: "meta-llama/llama-3.1-8b-instruct:free",
      label: "Llama 3.1 8B (free)",
    },
    {
      value: "google/gemma-2-9b-it:free",
      label: "Gemma 2 9B (free)",
    },
    {
      value: "mistralai/mistral-7b-instruct:free",
      label: "Mistral 7B (free)",
    },
    {
      value: "qwen/qwen3-8b:free",
      label: "Qwen3 8B (free)",
    },
  ],
};

function CreateSessionDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [model, setModel] = useState(providerModels.anthropic[0].value);
  const createSession = useCreateSession();

  function handleProviderChange(p: Provider) {
    setProvider(p);
    setModel(providerModels[p][0].value);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    createSession.mutate(
      {
        title: title.trim() || undefined,
        displayName: displayName.trim(),
        apiKey: apiKey.trim() || undefined,
        provider,
        model,
      },
      {
        onSuccess: () => setOpen(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="h-12 gap-2 bg-steel text-base font-medium text-white hover:bg-ocean"
        >
          <Plus className="size-4" />
          New session
        </Button>
      </DialogTrigger>
      <DialogContent className="border-charcoal/40 bg-deep-navy">
        <DialogHeader>
          <DialogTitle className="text-white">Create a new session</DialogTitle>
          <DialogDescription className="text-silver/60">
            Start a collaborative AI conversation. Share the link to invite
            others.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="display-name" className="text-silver">
              Your name
            </Label>
            <Input
              id="display-name"
              placeholder="How others will see you"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              className="border-charcoal/50 bg-midnight text-cloud placeholder:text-silver/40"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="session-title" className="text-silver">
              Session title
              <span className="ml-1 text-silver/40">(optional)</span>
            </Label>
            <Input
              id="session-title"
              placeholder="e.g. Sprint planning, Brainstorm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-charcoal/50 bg-midnight text-cloud placeholder:text-silver/40"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-silver">AI provider</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange("anthropic")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  provider === "anthropic"
                    ? "border-steel bg-steel/10 text-cloud"
                    : "border-charcoal/50 bg-midnight text-silver/60 hover:border-charcoal"
                }`}
              >
                Anthropic
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange("gemini")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  provider === "gemini"
                    ? "border-steel bg-steel/10 text-cloud"
                    : "border-charcoal/50 bg-midnight text-silver/60 hover:border-charcoal"
                }`}
              >
                Gemini
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange("openrouter")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  provider === "openrouter"
                    ? "border-steel bg-steel/10 text-cloud"
                    : "border-charcoal/50 bg-midnight text-silver/60 hover:border-charcoal"
                }`}
              >
                OpenRouter
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="text-silver">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="border-charcoal/50 bg-midnight text-cloud">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-charcoal/40 bg-deep-navy">
                {providerModels[provider].map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api-key" className="text-silver">
              API key
              <span className="ml-1 text-silver/40">(optional)</span>
            </Label>
            <Input
              id="api-key"
              type="password"
              placeholder={
                provider === "anthropic"
                  ? "sk-ant-..."
                  : provider === "gemini"
                    ? "AIza..."
                    : "sk-or-..."
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="border-charcoal/50 bg-midnight text-cloud placeholder:text-silver/40"
            />
            <p className="text-xs text-silver/40">
              Uses the server key if not provided.
            </p>
          </div>
          {createSession.isError && (
            <p className="text-sm text-red-400">
              Failed to create session. Please try again.
            </p>
          )}
          <DialogFooter className="border-charcoal/30 bg-deep-navy/80">
            <Button
              type="submit"
              disabled={!displayName.trim() || createSession.isPending}
              className="bg-steel text-white hover:bg-ocean"
            >
              {createSession.isPending ? "Creating..." : "Create session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const [sessionCode, setSessionCode] = useState("");
  const navigate = useNavigate();

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (sessionCode.trim()) {
      navigate(`/join/${sessionCode.trim()}`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-charcoal/30 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-semibold tracking-tight text-white">
            Duet
          </h1>
          <Badge variant="outline" className="border-steel/30 text-steel">
            Beta
          </Badge>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Think together,
            <br />
            <span className="text-steel">in real time</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-silver/80">
            Multiple participants, one shared AI context. Watch the conversation
            unfold as it streams.
          </p>

          <div className="mx-auto mt-10 grid max-w-lg gap-4 sm:grid-cols-2">
            <CreateSessionDialog />

            <form onSubmit={handleJoin} className="flex gap-2">
              <Input
                placeholder="Session code"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value)}
                className="h-12 border-charcoal/50 bg-deep-navy text-cloud placeholder:text-silver/40"
              />
              <Button
                type="submit"
                size="lg"
                variant="outline"
                disabled={!sessionCode.trim()}
                className="h-12 shrink-0 border-charcoal/50 px-3"
              >
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </div>
        </div>

        <Separator className="mx-auto my-16 max-w-xs bg-charcoal/30" />

        <div className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={Users}
            title="Multi-participant"
            description="Invite anyone with a link. Everyone contributes to the same AI conversation."
          />
          <FeatureCard
            icon={Zap}
            title="Live streaming"
            description="AI responses stream to all participants simultaneously. No waiting, no reloading."
          />
          <FeatureCard
            icon={Sparkles}
            title="Shared context"
            description="Every message from every participant feeds into a single, unified AI context."
          />
        </div>
      </main>

      <footer className="flex items-center justify-center gap-3 border-t border-charcoal/20 px-4 py-3 text-xs text-silver/40 sm:px-6 sm:py-4">
        <span>Duet - Open source under MIT</span>
        <a
          href="https://github.com/joelfickson/joinduet"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-silver/60 transition-colors hover:text-steel"
        >
          <Github className="size-3.5" />
          Contribute
        </a>
      </footer>
    </div>
  );
}
