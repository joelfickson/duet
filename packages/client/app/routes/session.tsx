import type { Message } from "@duet/shared";
import {
  Copy,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
  Reply,
  Send,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import remarkGfm from "remark-gfm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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

function ReplyPreviewInline({
  senderName,
  content,
}: {
  senderName: string;
  content: string;
}) {
  const snippet = content.length > 80 ? `${content.slice(0, 80)}...` : content;
  return (
    <div className="mb-1.5 border-l-2 border-steel/40 pl-2 text-xs text-silver/50">
      <span className="font-medium text-steel/70">{senderName}</span>
      <p className="truncate">{snippet}</p>
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  onReply,
}: {
  message: Message;
  isOwn: boolean;
  onReply: (message: Message) => void;
}) {
  const isAi = message.role === "assistant";

  return (
    <div className={`group flex ${isOwn ? "justify-end" : "justify-start"}`}>
      {isOwn && (
        <button
          type="button"
          onClick={() => onReply(message)}
          className="mr-1 self-center opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Reply className="size-3.5 text-silver/40 hover:text-silver/70" />
        </button>
      )}
      <div
        className={`max-w-[85%] rounded-xl px-4 py-2.5 sm:max-w-[75%] ${
          isOwn
            ? "bg-steel/20 text-cloud"
            : isAi
              ? "bg-ocean/10 border border-ocean/20 text-cloud"
              : "bg-charcoal/30 text-cloud"
        }`}
      >
        {message.replyTo && (
          <ReplyPreviewInline
            senderName={message.replyTo.senderName}
            content={message.replyTo.content}
          />
        )}
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
      {!isOwn && (
        <button
          type="button"
          onClick={() => onReply(message)}
          className="ml-1 self-center opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Reply className="size-3.5 text-silver/40 hover:text-silver/70" />
        </button>
      )}
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl border border-ocean/20 bg-ocean/10 px-4 py-2.5 text-cloud sm:max-w-[75%]">
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
  const replyTo = useSessionStore((s) => s.replyTo);
  const setReplyTo = useSessionStore((s) => s.setReplyTo);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const replySnippet = replyTo
    ? replyTo.content.length > 60
      ? `${replyTo.content.slice(0, 60)}...`
      : replyTo.content
    : null;

  return (
    <div>
      {replyTo && (
        <div className="flex items-center gap-2 border-b border-charcoal/20 px-3 py-2 sm:px-4">
          <Reply className="size-3.5 shrink-0 text-steel/60" />
          <div className="min-w-0 flex-1 text-xs text-silver/50">
            <span className="font-medium text-steel/70">
              {replyTo.senderName}
            </span>
            <p className="truncate">{replySnippet}</p>
          </div>
          <button type="button" onClick={() => setReplyTo(null)}>
            <X className="size-3.5 text-silver/40 hover:text-silver/70" />
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 sm:p-4">
        <Input
          ref={inputRef}
          placeholder={replyTo ? "Reply..." : "Type a message..."}
          value={value}
          onChange={handleChange}
          autoFocus
          className="h-11 min-w-0 flex-1 border-charcoal/50 bg-deep-navy text-cloud placeholder:text-silver/40"
        />
        <Button
          type="submit"
          disabled={!value.trim()}
          className="h-11 shrink-0 bg-steel px-4 text-white hover:bg-ocean"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

function PresenceSidebar({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const participants = useSessionStore((s) => s.participants);
  const typingParticipants = useSessionStore((s) => s.typingParticipants);
  const participantId = useSessionStore((s) => s.participantId);
  const status = useSessionStore((s) => s.status);

  return (
    <>
      {open && (
        <button
          type="button"
          onClick={onToggle}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-30 flex h-full w-64 flex-col border-l border-charcoal/30 bg-deep-navy transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-charcoal/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-silver/60" />
            <span className="text-sm font-medium text-cloud">
              Participants ({participants.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-1 text-silver/60 hover:text-cloud md:hidden"
          >
            <PanelRightClose className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-1">
            {participants.map((p) => {
              const isMe = p.id === participantId;
              const isCurrentlyTyping = typingParticipants.has(p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-charcoal/20"
                >
                  <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-charcoal/40 text-xs font-medium text-cloud">
                    {p.name.charAt(0).toUpperCase()}
                    <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-deep-navy bg-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-cloud">
                      {p.name}
                      {isMe && (
                        <span className="ml-1 text-xs text-silver/40">
                          (you)
                        </span>
                      )}
                    </p>
                    {isCurrentlyTyping && (
                      <p className="text-xs text-steel italic">typing...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-charcoal/30 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-silver/40">
            <span
              className={`size-2 rounded-full ${status === "connected" ? "bg-emerald-400" : "bg-red-400"}`}
            />
            {status === "connected" ? "Connected" : "Disconnected"}
          </div>
        </div>
      </aside>
    </>
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 sm:px-6">
      <h2 className="font-display text-2xl font-semibold text-white">
        Join session
      </h2>
      <p className="mt-2 text-center text-silver/60">
        Enter your name to join this session.
      </p>
      <form onSubmit={handleJoin} className="mt-6 flex w-full max-w-xs gap-2">
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="h-11 min-w-0 flex-1 border-charcoal/50 bg-deep-navy text-cloud placeholder:text-silver/40"
        />
        <Button
          type="submit"
          disabled={!name.trim()}
          className="h-11 shrink-0 bg-steel text-white hover:bg-ocean"
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
  const setReplyTo = useSessionStore((s) => s.setReplyTo);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  function handleReply(message: Message) {
    setReplyTo({
      messageId: message.id,
      content: message.content,
      senderName: message.role === "assistant" ? "AI" : message.senderName,
    });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(
      `${window.location.origin}/join/${sessionId}`,
    );
  }

  return (
    <JoinGate sessionId={sessionId}>
      <div className="flex h-dvh flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-charcoal/30 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="font-display text-lg font-semibold text-white"
            >
              Duet
            </Link>
            <span className="hidden font-mono text-xs text-silver/40 sm:inline">
              {sessionId}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="h-9 w-9 p-0 text-silver/60 hover:text-cloud sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5"
            >
              <Copy className="size-4 sm:size-3.5" />
              <span className="hidden sm:inline text-xs">Invite</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-9 w-9 p-0 text-silver/60 hover:text-cloud md:hidden"
            >
              <PanelRightOpen className="size-4" />
            </Button>
            <div className="hidden items-center gap-1 text-xs text-silver/50 md:flex">
              <Users className="size-3.5" />
              <span>{participants.length}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeave}
              className="h-9 w-9 p-0 text-red-400/70 hover:text-red-400 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5"
            >
              <LogOut className="size-4 sm:size-3.5" />
              <span className="hidden sm:inline text-xs">Leave</span>
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
            <div className="mt-auto flex flex-col gap-3">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isOwn={m.senderId === participantId}
                  onReply={handleReply}
                />
              ))}
              {isAiStreaming && (
                <StreamingBubble content={aiStreamingContent} />
              )}
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

          <PresenceSidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        </div>

        <div className="shrink-0 border-t border-charcoal/30">
          <MessageInput />
        </div>
      </div>
    </JoinGate>
  );
}
