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

function CreateSessionDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const createSession = useCreateSession();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    createSession.mutate(
      { title: title.trim() || undefined, displayName: displayName.trim() },
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
      <header className="flex items-center justify-between border-b border-charcoal/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-semibold tracking-tight text-white">
            Duet
          </h1>
          <Badge variant="outline" className="border-steel/30 text-steel">
            Beta
          </Badge>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
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

      <footer className="flex items-center justify-center gap-3 border-t border-charcoal/20 px-6 py-4 text-xs text-silver/40">
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
