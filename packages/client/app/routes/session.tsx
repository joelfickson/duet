import type { Message } from "@duet/shared";
import { Copy, LogOut, Send, Users } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { useSessionStore } from "~/stores/session-store";

function generateParticipantId() {
  return crypto.randomUUID();
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
          isOwn
            ? "bg-steel/20 text-cloud"
            : message.role === "assistant"
              ? "bg-ocean/10 border border-ocean/20 text-cloud"
              : "bg-charcoal/30 text-cloud"
        }`}
      >
        {!isOwn && message.role === "user" && (
          <p className="mb-1 text-xs font-medium text-steel">
            {message.senderName}
          </p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        <p className="mt-1 text-right text-[10px] text-silver/30">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const text =
    names.length === 1
      ? `${names[0]} is typing...`
      : `${names.join(", ")} are typing...`;
  return <p className="px-4 text-xs text-silver/50 italic">{text}</p>;
}

function MessageInput() {
  const [value, setValue] = useState("");
  const sendMessage = useSessionStore((s) => s.sendMessage);
  const sendTyping = useSessionStore((s) => s.sendTyping);
  const typingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setValue("");
    typingRef.current = false;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);

    if (!typingRef.current) {
      typingRef.current = true;
      sendTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingRef.current = false;
      sendTyping(false);
    }, 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4">
      <Input
        placeholder="Type a message..."
        value={value}
        onChange={handleChange}
        autoFocus
        className="h-11 flex-1 border-charcoal/50 bg-deep-navy text-cloud placeholder:text-silver/40"
      />
      <Button
        type="submit"
        disabled={!value.trim()}
        className="h-11 bg-steel px-4 text-white hover:bg-ocean"
      >
        <Send className="size-4" />
      </Button>
    </form>
  );
}

function PresencePanel() {
  const participants = useSessionStore((s) => s.participants);

  return (
    <div className="flex items-center gap-2 text-sm text-silver/60">
      <Users className="size-4" />
      <span>{participants.length}</span>
      <Separator orientation="vertical" className="h-4 bg-charcoal/30" />
      <div className="flex gap-1.5 overflow-hidden">
        {participants.map((p) => (
          <span
            key={p.id}
            className="shrink-0 rounded-full bg-charcoal/30 px-2 py-0.5 text-xs text-silver"
          >
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function JoinGate({
  sessionId,
  children,
}: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const status = useSessionStore((s) => s.status);
  const connect = useSessionStore((s) => s.connect);
  const location = useLocation();
  const [name, setName] = useState(
    (location.state as { displayName?: string } | null)?.displayName ?? "",
  );

  if (status === "connected") {
    return <>{children}</>;
  }

  if (status === "connecting") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-silver/50">Connecting...</p>
      </div>
    );
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    connect(sessionId, generateParticipantId(), name.trim());
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <h2 className="font-display text-2xl font-semibold text-white">
        Join session
      </h2>
      <p className="mt-2 text-silver/60">
        Enter your name to join this session.
      </p>
      <form onSubmit={handleJoin} className="mt-6 flex w-full max-w-xs gap-2">
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="h-11 border-charcoal/50 bg-deep-navy text-cloud placeholder:text-silver/40"
        />
        <Button
          type="submit"
          disabled={!name.trim()}
          className="h-11 bg-steel text-white hover:bg-ocean"
        >
          Join
        </Button>
      </form>
    </div>
  );
}

export default function Session() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const messages = useSessionStore((s) => s.messages);
  const participantId = useSessionStore((s) => s.participantId);
  const participants = useSessionStore((s) => s.participants);
  const typingParticipants = useSessionStore((s) => s.typingParticipants);
  const aiStreamingContent = useSessionStore((s) => s.aiStreamingContent);
  const isAiStreaming = useSessionStore((s) => s.isAiStreaming);
  const error = useSessionStore((s) => s.error);
  const disconnect = useSessionStore((s) => s.disconnect);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const typingNames = participants
    .filter((p) => typingParticipants.has(p.id) && p.id !== participantId)
    .map((p) => p.name);

  function handleLeave() {
    disconnect();
    navigate("/");
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(
      `${window.location.origin}/join/${sessionId}`,
    );
  }

  return (
    <JoinGate sessionId={sessionId}>
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b border-charcoal/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="font-display text-lg font-semibold text-white"
            >
              Duet
            </Link>
            <span className="font-mono text-xs text-silver/40">
              {sessionId}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <PresencePanel />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5 text-xs text-silver/60 hover:text-cloud"
            >
              <Copy className="size-3.5" />
              Invite
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeave}
              className="gap-1.5 text-xs text-red-400/70 hover:text-red-400"
            >
              <LogOut className="size-3.5" />
              Leave
            </Button>
          </div>
        </header>

        <main className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
          <div className="mt-auto flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isOwn={m.senderId === participantId}
              />
            ))}
            {isAiStreaming && aiStreamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-xl border border-ocean/20 bg-ocean/10 px-4 py-2.5 text-cloud">
                  <p className="mb-1 text-xs font-medium text-ocean">AI</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {aiStreamingContent}
                    <span className="inline-block h-4 w-1 animate-pulse bg-ocean/60" />
                  </p>
                </div>
              </div>
            )}
            <TypingIndicator names={typingNames} />
            {error && (
              <p className="text-center text-xs text-red-400/70">{error}</p>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <div className="border-t border-charcoal/30">
          <MessageInput />
        </div>
      </div>
    </JoinGate>
  );
}
