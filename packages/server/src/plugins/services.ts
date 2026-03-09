import fp from "fastify-plugin";
import AiService from "../services/ai";
import BroadcastService from "../services/broadcast";
import ConnectionService from "../services/connections";
import ContextService from "../services/context";
import HeartbeatService from "../services/heartbeat";
import MessageService from "../services/messages";
import RateLimitService from "../services/rate-limit";
import ReconnectionService from "../services/reconnection";
import RetryService from "../services/retry";
import SessionService from "../services/sessions";
import SystemPromptService from "../services/system-prompt";
import TypingService from "../services/typing";

declare module "fastify" {
  interface FastifyInstance {
    aiService: AiService;
    broadcastService: BroadcastService;
    connectionService: ConnectionService;
    contextService: ContextService;
    heartbeatService: HeartbeatService;
    messageService: MessageService;
    rateLimitService: RateLimitService;
    reconnectionService: ReconnectionService;
    retryService: RetryService;
    sessionService: SessionService;
    systemPromptService: SystemPromptService;
    typingService: TypingService;
  }
}

export default fp(async (fastify) => {
  const connectionService = new ConnectionService();
  const sessionService = new SessionService();
  const heartbeatService = new HeartbeatService();
  const messageService = new MessageService();
  const rateLimitService = new RateLimitService();
  const reconnectionService = new ReconnectionService();
  const typingService = new TypingService();
  const contextService = new ContextService();
  const systemPromptService = new SystemPromptService();
  const retryService = new RetryService();

  const broadcastService = new BroadcastService(
    connectionService,
    sessionService,
  );

  const aiService = new AiService(
    broadcastService,
    contextService,
    sessionService,
    systemPromptService,
    retryService,
  );

  fastify.decorate("aiService", aiService);
  fastify.decorate("broadcastService", broadcastService);
  fastify.decorate("connectionService", connectionService);
  fastify.decorate("contextService", contextService);
  fastify.decorate("heartbeatService", heartbeatService);
  fastify.decorate("messageService", messageService);
  fastify.decorate("rateLimitService", rateLimitService);
  fastify.decorate("reconnectionService", reconnectionService);
  fastify.decorate("retryService", retryService);
  fastify.decorate("sessionService", sessionService);
  fastify.decorate("systemPromptService", systemPromptService);
  fastify.decorate("typingService", typingService);
});
