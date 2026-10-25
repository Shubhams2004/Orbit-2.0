import { ChatMessage, ChatAttachment, AgentAction, Task, Project } from '../types';
import { agentService } from './agentService';
import { apiClient, ApiError, isProductionEnv } from './apiClient';
import { isDemoConversationId } from './conversationService';

export interface SendMessageOptions {
  conversationId: string;
  content: string;
  modelId: string;
  attachments?: ChatAttachment[];
  onChunk?: (accumulatedContent: string) => void;
  signal?: AbortSignal;
  tasksContext?: Task[];
  projectsContext?: Project[];
}

export interface IChatService {
  getMessages(conversationId: string): Promise<ChatMessage[]>;
  sendMessage(options: SendMessageOptions): Promise<ChatMessage>;
  deleteMessage(conversationId: string, messageId: string): Promise<boolean>;
  clearConversationMessages(conversationId: string): Promise<boolean>;
}

const STORAGE_KEY_PREFIX = 'orbit_chat_messages_v2_';

export const INITIAL_MESSAGES_MAP: Record<string, ChatMessage[]> = {
  conv_plan_today: [
    {
      id: 'msg_init_01',
      conversationId: 'conv_plan_today',
      role: 'user',
      content: 'Summarize my pending tasks and plan my morning workflow.',
      timestamp: '2026-10-14T08:31:00.000Z',
      modelUsed: 'orbit-agent-v2',
    },
    {
      id: 'msg_init_02',
      conversationId: 'conv_plan_today',
      role: 'assistant',
      content: `I've analyzed your workspace state and active commitments for **Wednesday, October 14, 2026**.

### Daily Triage Summary
You have **3 urgent/high deliverables due today** and **2 overdue items** requiring attention.

| Task | Priority | Status | Due Date |
| :--- | :--- | :--- | :--- |
| **Verify SOC2 encryption key rotation schedule** | Urgent | In Progress | 2026-10-13 (Overdue) |
| **Finalize Agent human-in-the-loop approval protocol** | Urgent | In Progress | 2026-10-14 (Today) |
| **Sync with Security auditor on access log retention** | High | To Do | 2026-10-14 (Today) |

### Recommended Morning Focus Block
1. **09:00 - 10:30**: Finalize the SOC2 key rotation verification to close the overdue compliance SLA.
2. **10:45 - 12:00**: Complete the human-in-the-loop approval spec.

I've formulated an action proposal to reschedule non-critical tasks to tomorrow:`,
      timestamp: '2026-10-14T08:31:05.000Z',
      modelUsed: 'orbit-agent-v2',
      status: 'complete',
      actions: [
        {
          id: 'act_init_plan_1',
          type: 'reschedule_task',
          title: 'Reschedule D1 schema review to Oct 15',
          description: 'Postpones secondary database review to allow focus on SOC2 deliverables.',
          data: {
            taskId: 'task_001',
            taskTitle: 'Review D1 database schema migration draft',
            newDueDate: '2026-10-15',
          },
          status: 'proposed',
        },
      ],
      isSimulated: true,
    },
  ],
  conv_soc2_audit: [
    {
      id: 'msg_soc_01',
      conversationId: 'conv_soc2_audit',
      role: 'user',
      content: 'What are the core technical requirements for SOC2 Type II Trust Services Criteria CC6.1 and CC6.6?',
      timestamp: '2026-10-13T14:16:00.000Z',
      modelUsed: 'claude-3-7-sonnet',
    },
    {
      id: 'msg_soc_02',
      conversationId: 'conv_soc2_audit',
      role: 'assistant',
      content: `For **SOC 2 Type II**, Common Criteria 6.1 and 6.6 govern logical access security and boundary protection:

### CC6.1: Logical Access Controls
- **Identity & Access Management (IAM)**: Role-Based Access Control (RBAC) enforced with the principle of least privilege.
- **Multi-Factor Authentication (MFA)**: Mandatory for all administrative and edge infrastructure access.
- **Automated Revocation**: Deprovisioning within 24 hours of employee departure.

### CC6.6: Perimeter Protection & Encryption in Transit
- **TLS 1.3 Baseline**: Deprecation of legacy cipher suites and unencrypted HTTP endpoints.
- **Network Boundaries**: Edge workers with Web Application Firewall (WAF) rate limiting and automated DDoS mitigation.

\`\`\`typescript
// Sample edge middleware validating mTLS and strict session claims
export async function verifyComplianceHeader(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  // Verify token expiry and claims against trusted certificate authority
  return token.length > 32;
}
\`\`\`

Would you like me to generate a verification task in your **Security & SOC2 Type II Audit** project for this checklist?`,
      timestamp: '2026-10-13T14:16:10.000Z',
      modelUsed: 'claude-3-7-sonnet',
      status: 'complete',
      isSimulated: true,
    },
  ],
  conv_cf_workers: [
    {
      id: 'msg_cf_01',
      conversationId: 'conv_cf_workers',
      role: 'user',
      content: 'Outline the architecture for migrating our mock TaskService to Cloudflare Workers with D1.',
      timestamp: '2026-10-12T10:01:00.000Z',
      modelUsed: 'gpt-4o',
    },
    {
      id: 'msg_cf_02',
      conversationId: 'conv_cf_workers',
      role: 'assistant',
      content: `Here is the target architecture for the Cloudflare Workers + D1 backend migration:

### 1. Edge API Routes (\`src/worker.ts\`)
- Mount lightweight router handling:
  - \`GET /api/tasks\`
  - \`POST /api/tasks\`
  - \`PATCH /api/tasks/:id\`
  - \`DELETE /api/tasks/:id\`
  - \`POST /api/agent/chat\` (with Server-Sent Events / SSE streaming)

### 2. D1 SQL Schema Draft
\`\`\`sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  project_id TEXT,
  priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status TEXT CHECK(status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
  due_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
\`\`\`

The current frontend interfaces in Orbit 2.0 cleanly isolate this layer, so when you are ready to connect, only the service implementation file will be updated.`,
      timestamp: '2026-10-12T10:01:12.000Z',
      modelUsed: 'gpt-4o',
      status: 'complete',
      isSimulated: true,
    },
  ],
};

export class MockChatService implements IChatService {
  private loadMessages(conversationId: string): ChatMessage[] {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${conversationId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return INITIAL_MESSAGES_MAP[conversationId] || [];
  }

  private saveMessages(conversationId: string, messages: ChatMessage[]): void {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${conversationId}`, JSON.stringify(messages));
    } catch {}
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    if (!conversationId) return [];

    // Fetch persisted messages from server for real user conversations
    if (!isDemoConversationId(conversationId)) {
      try {
        const serverMsgs = await apiClient.get<
          Array<{
            id: string;
            conversationId: string;
            role: 'user' | 'assistant' | 'system';
            content: string;
            createdAt: string;
          }>
        >(`/api/v1/conversations/${conversationId}/messages`);

        if (Array.isArray(serverMsgs) && serverMsgs.length > 0) {
          const mapped: ChatMessage[] = serverMsgs.map((m) => ({
            id: m.id,
            conversationId: m.conversationId,
            role: m.role,
            content: m.content,
            timestamp: m.createdAt,
            status: 'complete' as const,
          }));
          this.saveMessages(conversationId, mapped);
          return mapped;
        }
      } catch {
        // Fall back to locally cached messages
      }
    }

    return this.loadMessages(conversationId);
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<boolean> {
    const list = this.loadMessages(conversationId);
    const updated = list.filter((m) => m.id !== messageId);
    this.saveMessages(conversationId, updated);
    return true;
  }

  async clearConversationMessages(conversationId: string): Promise<boolean> {
    this.saveMessages(conversationId, []);
    return true;
  }

  /**
   * Generates a context-aware mock AI response with token streaming simulation
   * and agent capabilities (proposed actions) when relevant.
   */
  async sendMessage(options: SendMessageOptions): Promise<ChatMessage> {
    const {
      conversationId,
      content,
      modelId,
      attachments = [],
      onChunk,
      signal,
      tasksContext = [],
      projectsContext = [],
    } = options;

    let targetConvId = conversationId;
    // Never send demo or seed conversation IDs to the API
    const isTargetDemo = isDemoConversationId(conversationId);
    const apiConversationId = !isTargetDemo && conversationId?.trim() ? conversationId.trim() : undefined;

    const messages = targetConvId ? this.loadMessages(targetConvId) : [];

    // 1. Record User Message
    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      conversationId: targetConvId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      modelUsed: modelId,
      attachments,
      status: 'complete',
    };

    messages.push(userMsg);
    if (targetConvId) {
      this.saveMessages(targetConvId, messages);
    }

    // 2. Obtain AI Response (Live Cloudflare Workers AI with graceful local fallback)
    let fullText = '';
    let assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let activeModelName = modelId;
    let proposedActions: AgentAction[] | undefined;
    let isSimulated = false;

    try {
      const aiResult = await apiClient.post<{
        response: string;
        conversationId: string;
        messageId: string;
        model: string;
      }>('/api/v1/ai/chat', {
        prompt: content,
        conversationId: apiConversationId,
      });

      if (aiResult && aiResult.response) {
        fullText = aiResult.response;
        assistantMsgId = aiResult.messageId || assistantMsgId;
        activeModelName = aiResult.model || modelId;

        // When the server creates a new conversation, update the target conversation ID
        if (aiResult.conversationId) {
          targetConvId = aiResult.conversationId;
          userMsg.conversationId = targetConvId;
        }
      } else {
        throw new ApiError('EMPTY_AI_RESPONSE', 'Empty AI response received from Cloudflare Workers AI.', 502);
      }
    } catch (err: unknown) {
      const isAuthError =
        (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.code.includes('AUTH') || err.code.includes('TOKEN'))) ||
        (err instanceof Error && (
          err.message.includes('401') ||
          err.message.includes('403') ||
          err.message.toLowerCase().includes('token') ||
          err.message.toLowerCase().includes('unauthorized') ||
          err.message.toLowerCase().includes('bearer')
        ));

      // Never silently fall back to simulated responses on HTTP 401, 403, or authentication errors
      if (isAuthError) {
        const errorMsg = err instanceof Error ? err.message : 'Authentication required to use AI chat.';
        const assistantErrorMsg: ChatMessage = {
          id: assistantMsgId,
          conversationId: targetConvId,
          role: 'assistant',
          content: `⚠️ Authentication Error: ${errorMsg}`,
          timestamp: new Date().toISOString(),
          modelUsed: modelId,
          status: 'error',
          errorMessage: errorMsg,
          isSimulated: false,
        };
        messages.push(assistantErrorMsg);
        if (targetConvId) {
          this.saveMessages(targetConvId, messages);
        }
        throw err;
      }

      // In production, never fall back to simulated responses for any error
      if (isProductionEnv()) {
        const errorMsg = err instanceof Error ? err.message : 'AI service unavailable in production.';
        const assistantErrorMsg: ChatMessage = {
          id: assistantMsgId,
          conversationId: targetConvId,
          role: 'assistant',
          content: `⚠️ AI Service Error: ${errorMsg}`,
          timestamp: new Date().toISOString(),
          modelUsed: modelId,
          status: 'error',
          errorMessage: errorMsg,
          isSimulated: false,
        };
        messages.push(assistantErrorMsg);
        if (targetConvId) {
          this.saveMessages(targetConvId, messages);
        }
        throw err;
      }

      // Local fallback in non-production development only when Workers AI binding is unavailable
      const synthesized = await this.synthesizeResponse(
        content,
        modelId,
        attachments,
        tasksContext,
        projectsContext
      );
      fullText = synthesized.fullText;
      proposedActions = synthesized.proposedActions;
      isSimulated = true;
    }

    // 3. Simulate Streaming with Chunks for Responsive UI
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      conversationId: targetConvId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      modelUsed: activeModelName,
      actions: proposedActions,
      status: 'streaming',
      isSimulated,
    };

    messages.push(assistantMsg);
    if (targetConvId) {
      this.saveMessages(targetConvId, messages);
    }

    // Token-by-token streaming simulation
    const words = fullText.split(' ');
    let accumulated = '';
    const chunkSize = 3; // stream 3 words per tick
    const delayMs = 35; // smooth typing pace

    try {
      for (let i = 0; i < words.length; i += chunkSize) {
        if (signal?.aborted) {
          assistantMsg.status = 'stopped';
          assistantMsg.content = accumulated + ' [Generation stopped by user]';
          if (targetConvId) this.saveMessages(targetConvId, messages);
          if (onChunk) onChunk(assistantMsg.content);
          return assistantMsg;
        }

        const chunk = words.slice(i, i + chunkSize).join(' ') + ' ';
        accumulated += chunk;
        assistantMsg.content = accumulated.trim();
        if (onChunk) onChunk(assistantMsg.content);

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      assistantMsg.content = fullText;
      assistantMsg.status = 'complete';
      if (targetConvId) this.saveMessages(targetConvId, messages);
      if (onChunk) onChunk(fullText);
      return assistantMsg;
    } catch (err: unknown) {
      assistantMsg.status = 'error';
      assistantMsg.errorMessage = err instanceof Error ? err.message : 'Generation interrupted.';
      if (targetConvId) this.saveMessages(targetConvId, messages);
      return assistantMsg;
    }
  }

  private async synthesizeResponse(
    prompt: string,
    modelId: string,
    attachments: ChatAttachment[],
    tasks: Task[],
    projects: Project[]
  ): Promise<{ fullText: string; proposedActions?: AgentAction[] }> {
    const q = prompt.toLowerCase();
    let proposedActions: AgentAction[] | undefined;

    // Check if prompt invokes Agent task/project capabilities
    if (
      q.includes('plan') ||
      q.includes('overdue') ||
      q.includes('break') ||
      q.includes('task') ||
      q.includes('summarize') ||
      q.includes('workload') ||
      q.includes('project')
    ) {
      // Delegate to agent reasoning
      const agentResult = await agentService.processQuery(prompt, {
        tasks,
        projects,
        todayDate: '2026-10-14',
      });

      if (agentResult.run.actions.length > 0) {
        proposedActions = agentResult.run.actions;
      }

      return {
        fullText: agentResult.messageContent,
        proposedActions,
      };
    }

    // Attachment-specific response
    if (attachments.length > 0) {
      const names = attachments.map((a) => a.name).join(', ');
      return {
        fullText: `I have received and parsed your attachment(s): **${names}**.

### Analysis & Insights
- File structure parsed successfully.
- No syntax discrepancies or security violations found.
- All tokens aligned with modern TypeScript and Tailwind CSS conventions.

How would you like me to process or integrate this into your current roadmap?`,
      };
    }

    // Code / Technical question fallback
    if (q.includes('code') || q.includes('typescript') || q.includes('react') || q.includes('api')) {
      return {
        fullText: `Here is a high-performance implementation pattern designed for **${modelId}**:

\`\`\`typescript
import { useState, useCallback } from 'react';

/**
 * Custom hook for resilient edge state synchronization
 */
export function useEdgeSync<T>(key: string, initialValue: T) {
  const [data, setData] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState(false);

  const sync = useCallback(async (update: T) => {
    setIsPending(true);
    try {
      // Future Cloudflare Worker endpoint
      setData(update);
    } finally {
      setIsPending(false);
    }
  }, [key]);

  return { data, sync, isPending };
}
\`\`\`

### Key Architectural Benefits:
1. **Zero Layout Thrashing**: Uses fine-grained reactive updates.
2. **Edge Compatibility**: Complies with V8 isolates in Cloudflare Workers.
3. **Strict Typing**: No \`any\` types or unsafe casts.`,
      };
    }

    // General conversational response
    return {
      fullText: `I am responding as **${modelId}** in simulated prototype mode.

You asked:
> *${prompt}*

I can assist with:
- **Task Management**: *"Summarize my pending tasks"*, *"Find overdue items"*, *"Prioritize today's deliverables"*.
- **Project Roadmaps**: *"Break this project into tasks"*, *"Draft milestone architecture"*.
- **Code & Design**: Technical reviews, TypeScript patterns, and high-density UI specifications.

What would you like to explore next?`,
    };
  }
}

export const chatService = new MockChatService();
