import type { Message } from "@duet/shared";
import { Copy, LogOut, Send, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import remarkGfm from "remark-gfm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { useSessionStore } from "~/stores/session-store";

function generateParticipantId() {
  return crypto.randomUUID();
}

const remarkPlugins = [remarkGfm];

function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={remarkPlugins}
      components={{
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-md bg-midnight/80 px-3 py-2 font-mono text-xs text-cloud/90">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-midnight/60 px-1.5 py-0.5 font-mono text-xs text-cloud/90">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="my-2">{children}</pre>,
        ul: ({ children }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => (
          <h1 className="mb-2 text-lg font-semibold">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 text-base font-semibold">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 text-sm font-semibold">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-steel/30 pl-3 text-silver/70">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-steel underline underline-offset-2 hover:text-ocean"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-3 border-charcoal/30" />,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full text-left text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-charcoal/30 px-2 py-1 font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-charcoal/30 px-2 py-1">{children}</td>
        ),
      }}
    >
      {content}
    </Markdown>
  );
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  const isAi = message.role === "assistant";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
          isOwn
            ? "bg-steel/20 text-cloud"
            : isAi
              ? "bg-ocean/10 border border-ocean/20 text-cloud"
              : "bg-charcoal/30 text-cloud"
        }`}
      >
        {!isOwn && message.role === "user" && (
          <p className="mb-1 text-xs font-medium text-steel">
            {message.senderName}
          </p>
        )}
        {isAi && <p className="mb-1 text-xs font-medium text-ocean">AI</p>}
        <div className="text-sm">
          {isAi ? (
            <MarkdownContent content={message.content} />
          ) : (
            <p className="leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          )}
        </div>
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

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] rounded-xl border border-ocean/20 bg-ocean/10 px-4 py-2.5 text-cloud">
        <p className="mb-1 text-xs font-medium text-ocean">AI</p>
        {content ? (
          <div className="text-sm">
            <MarkdownContent content={content} />
            <span className="inline-block h-4 w-0.5 animate-pulse bg-ocean/60" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 py-1">
            <span className="size-1.5 animate-bounce rounded-full bg-ocean/60 [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-ocean/60 [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-ocean/60 [animation-delay:300ms]" />
          </div>
        )}
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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
  const aiError = useSessionStore((s) => s.aiError);
  const error = useSessionStore((s) => s.error);
  const disconnect = useSessionStore((s) => s.disconnect);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const typingNames = participants
    .filter((p) => typingParticipants.has(p.id) && p.id !== participantId)
    .map((p) => p.name);

  const scrollTrigger = `${messages.length}-${aiStreamingContent.length}-${isAiStreaming}`;
  useEffect(() => {
    void scrollTrigger;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [scrollTrigger]);

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
            {isAiStreaming && <StreamingBubble content={aiStreamingContent} />}
            <TypingIndicator names={typingNames} />
            {aiError && (
              <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-2 text-center text-sm text-red-400/80">
                {aiError}
              </div>
            )}
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
