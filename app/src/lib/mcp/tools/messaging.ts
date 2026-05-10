import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeTool, textResult, type Tool } from "../types";

const listConversations = makeTool({
  name: "messaging.list_conversations",
  description: "List recent SMS conversations with members and external phones.",
  required: ["messaging.read"],
  inputSchema: z.object({
    unreadOnly: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async handler(input) {
    const conversations = await prisma.conversation.findMany({
      where: input.unreadOnly ? { unread: true } : {},
      orderBy: { lastMessageAt: "desc" },
      take: input.limit,
      include: {
        member: { select: { firstName: true, lastName: true, memberNumber: true } },
      },
    });
    return textResult(`${conversations.length} conversations.`, conversations);
  },
});

const getConversation = makeTool({
  name: "messaging.get_conversation",
  description: "Fetch a conversation by ID with the last N messages.",
  required: ["messaging.read"],
  inputSchema: z.object({
    conversationId: z.string().min(1),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  async handler(input) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: {
        member: true,
        messages: { orderBy: { createdAt: "desc" }, take: input.limit },
      },
    });
    if (!conversation) return textResult("Conversation not found.", null);
    return textResult(`Conversation with ${conversation.phone}`, conversation);
  },
});

export const messagingTools: Tool[] = [
  listConversations as unknown as Tool,
  getConversation as unknown as Tool,
];
