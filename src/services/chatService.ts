import { ChatMessage, ChatAttachment, AgentAction, Task, Project } from '../types';
import { agentService } from './agentService';
import { apiClient, ApiError, isProductionEnv } from './apiClient';
import { isDemoConversationId } from './conversationService';

export interface StreamMetaUpdate {
  conversationId?: string;
  model?: string;
  provider?: string;
  webSearch?: any;
  deprecationNotice?: string;
}

export interface SendMessageOptions {
  conversationId: string;
  content: string;
  modelId: string;
  attachments?: ChatAttachment[];
  webSearch?: boolean;
  retry?: boolean;
  onChunk?: (accumulatedContent: string, meta?: StreamMetaUpdate) => void;
  onMeta?: (meta: StreamMetaUpdate) => void;
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

  private formatReadableAiError(err: unknown, modelId: string): {
    message: string;
    code: string;
    status: number;
    retryable: boolean;
    provider?: string;
    partialText?: string;
    conversationId?: string;
  } {
    if (err instanceof ApiError) {
      const details = (err.details || {}) as Record<string, any>;
      const provider = typeof details.provider === 'string' ? details.provider : undefined;
      const partialText = typeof details.partialText === 'string' ? details.partialText : undefined;
      const conversationId =
        typeof details.conversationId === 'string' ? details.conversationId : undefined;
      const raw = err.message || '';
      const lower = raw.toLowerCase();

      if (err.code === 'GATEWAY_TIMEOUT' || err.code === 'UPSTREAM_TIMEOUT' || err.code === 'REQUEST_TIMEOUT' || err.status === 524 || err.status === 504 || lower.includes('524')) {
        return {
          message:
            'The AI provider timed out while waiting for a response. This can happen during high load or complex prompts — click Retry to try again, or switch to a faster model.',
          code: err.code,
          status: err.status || 504,
          retryable: true,
          provider,
          partialText,
          conversationId,
        };
      }

      if (err.code === 'QUOTA_EXHAUSTED' || err.status === 429) {
        return {
          message:
            'Rate limit or API quota reached for your connected provider. Wait a brief moment and click Retry, or verify your provider billing/quota.',
          code: err.code,
          status: 429,
          retryable: true,
          provider,
          partialText,
          conversationId,
        };
      }

      if (err.code === 'AUTHENTICATION_FAILED' || err.status === 401 || err.status === 403) {
        return {
          message: raw.includes('API key')
            ? raw.replace(/^Gemini provider error:\s*/i, '')
            : 'Authentication failed for the selected AI provider. Please verify your API key in the model selector.',
          code: err.code,
          status: err.status || 401,
          retryable: false,
          provider,
          partialText,
          conversationId,
        };
      }

      if (err.code === 'MODEL_NOT_FOUND' || err.status === 404) {
        return {
          message: `The selected model ("${modelId}") is unsupported or unavailable for your API key. Please select another model.`,
          code: err.code,
          status: 404,
          retryable: false,
          provider,
          partialText,
          conversationId,
        };
      }

      if (err.code === 'STREAM_INTERRUPTED') {
        return {
          message: partialText
            ? 'The response stream was interrupted before completion. Your partial response was preserved above — click Retry to try again.'
            : 'The streaming connection was interrupted. Please click Retry to try again.',
          code: err.code,
          status: err.status || 502,
          retryable: true,
          provider,
          partialText,
          conversationId,
        };
      }

      return {
        message: raw.replace(/^(Gemini|OpenAI|Anthropic) provider error:\s*/i, '') || 'The AI provider could not complete this request.',
        code: err.code,
        status: err.status || 500,
        retryable: Boolean(details.retryable ?? (err.status >= 500 || err.status === 0)),
        provider,
        partialText,
        conversationId,
      };
    }

    const msg = err instanceof Error ? err.message : 'AI model request failed.';
    return {
      message: msg,
      code: 'AI_REQUEST_FAILED',
      status: 500,
      retryable: true,
    };
  }

  /**
   * Sends a message via real SSE streaming from Cloudflare Workers (/api/v1/ai/chat),
   * falling back to standard JSON parsing if a non-streaming response is returned.
   */
  async sendMessage(options: SendMessageOptions): Promise<ChatMessage> {
    const {
      conversationId,
      content,
      modelId,
      attachments = [],
      retry = false,
      onChunk,
      onMeta,
      signal,
      tasksContext = [],
      projectsContext = [],
    } = options;

    let targetConvId = conversationId;
    // Never send demo or seed conversation IDs to the API
    const isTargetDemo = isDemoConversationId(conversationId);
    const apiConversationId = !isTargetDemo && conversationId?.trim() ? conversationId.trim() : undefined;

    const messages = targetConvId ? this.loadMessages(targetConvId) : [];

    // 1. Record User Message locally unless this is a retry of an existing failed turn
    let userMsg: ChatMessage | undefined;
    const lastSavedMsg = messages[messages.length - 1];
    const shouldSkipLocalUserPush =
      retry &&
      ((lastSavedMsg?.role === 'user' && lastSavedMsg.content.trim() === content.trim()) ||
        (messages.length >= 2 &&
          messages[messages.length - 1]?.status === 'error' &&
          messages[messages.length - 2]?.role === 'user' &&
          messages[messages.length - 2]?.content.trim() === content.trim()));

    if (retry && messages[messages.length - 1]?.status === 'error') {
      messages.pop();
    }

    if (!shouldSkipLocalUserPush) {
      userMsg = {
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
    }

    // 2. Obtain AI Response via Real SSE Streaming
    let fullText = '';
    let assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let activeModelName = modelId;
    let activeProvider: string | undefined;
    let fallbackUsed = false;
    let proposedActions: AgentAction[] | undefined;
    let isSimulated = false;
    let webSearchMeta: any = undefined;
    let streamAlreadyRendered = false;

    try {
      const response = await apiClient.streamPost(
        '/api/v1/ai/chat',
        {
          prompt: content,
          conversationId: apiConversationId,
          model: modelId,
          allowFallback: false,
          webSearch: options.webSearch,
          stream: true,
          retry,
        },
        { signal }
      );

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && response.body) {
        streamAlreadyRendered = true;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedDone = false;
        let streamErrorPayload: any = null;

        const handleSseLine = (rawLine: string) => {
          if (!rawLine.startsWith('data:')) return;
          const jsonText = rawLine.slice(5).trim();
          if (!jsonText) return;

          let evt: any;
          try {
            evt = JSON.parse(jsonText);
          } catch {
            return;
          }

          if (evt.type === 'meta') {
            if (evt.conversationId) {
              targetConvId = evt.conversationId;
              if (userMsg) userMsg.conversationId = targetConvId;
            }
            if (evt.model) activeModelName = evt.model;
            if (evt.provider) activeProvider = evt.provider;
            if (evt.webSearch) webSearchMeta = evt.webSearch;
            onMeta?.({
              conversationId: targetConvId,
              model: activeModelName,
              provider: activeProvider,
              webSearch: webSearchMeta,
              deprecationNotice: evt.deprecationNotice,
            });
          } else if (evt.type === 'delta' && typeof evt.text === 'string') {
            fullText += evt.text;
            onChunk?.(fullText, {
              conversationId: targetConvId,
              model: activeModelName,
              provider: activeProvider,
              webSearch: webSearchMeta,
            });
          } else if (evt.type === 'done') {
            receivedDone = true;
            if (evt.messageId) assistantMsgId = evt.messageId;
            if (evt.conversationId) targetConvId = evt.conversationId;
            if (evt.model) activeModelName = evt.model;
            if (evt.provider) activeProvider = evt.provider;
            fallbackUsed = Boolean(evt.fallbackUsed);
            if (evt.webSearch) webSearchMeta = evt.webSearch;
          } else if (evt.type === 'error') {
            streamErrorPayload = evt;
          }
        };

        try {
          while (true) {
            if (signal?.aborted) {
              await reader.cancel().catch(() => {});
              const stoppedMsg: ChatMessage = {
                id: assistantMsgId,
                conversationId: targetConvId,
                role: 'assistant',
                content: fullText ? `${fullText}\n\n[Generation stopped by user]` : '[Generation stopped by user]',
                timestamp: new Date().toISOString(),
                modelUsed: activeModelName,
                provider: activeProvider,
                webSearch: webSearchMeta,
                status: 'stopped',
                isSimulated: false,
              };
              messages.push(stoppedMsg);
              if (targetConvId) this.saveMessages(targetConvId, messages);
              onChunk?.(stoppedMsg.content);
              return stoppedMsg;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              handleSseLine(line);
            }

            if (streamErrorPayload) {
              await reader.cancel().catch(() => {});
              break;
            }
          }

          if (!streamErrorPayload) {
            const rem = buffer + decoder.decode();
            for (const line of rem.split(/\r?\n/)) {
              handleSseLine(line);
            }
          }
        } catch (readErr: unknown) {
          await reader.cancel().catch(() => {});
          if (signal?.aborted) {
            const stoppedMsg: ChatMessage = {
              id: assistantMsgId,
              conversationId: targetConvId,
              role: 'assistant',
              content: fullText ? `${fullText}\n\n[Generation stopped by user]` : '[Generation stopped by user]',
              timestamp: new Date().toISOString(),
              modelUsed: activeModelName,
              provider: activeProvider,
              webSearch: webSearchMeta,
              status: 'stopped',
              isSimulated: false,
            };
            messages.push(stoppedMsg);
            if (targetConvId) this.saveMessages(targetConvId, messages);
            onChunk?.(stoppedMsg.content);
            return stoppedMsg;
          }

          throw new ApiError(
            'STREAM_INTERRUPTED',
            readErr instanceof Error ? readErr.message : 'Stream connection interrupted.',
            502,
            {
              provider: activeProvider,
              model: activeModelName,
              retryable: true,
              partialText: fullText.trim() || undefined,
              conversationId: targetConvId,
            }
          );
        }

        if (streamErrorPayload) {
          const partial =
            typeof streamErrorPayload.partialText === 'string' && streamErrorPayload.partialText
              ? streamErrorPayload.partialText
              : fullText.trim() || undefined;
          throw new ApiError(
            streamErrorPayload.code || 'PROVIDER_ERROR',
            streamErrorPayload.message || 'AI streaming request failed.',
            streamErrorPayload.status || 502,
            {
              provider: streamErrorPayload.provider || activeProvider,
              model: streamErrorPayload.model || activeModelName,
              retryable: streamErrorPayload.retryable ?? true,
              upstreamStatus: streamErrorPayload.upstreamStatus,
              partialText: partial,
              conversationId: streamErrorPayload.conversationId || targetConvId,
            }
          );
        }

        if (!receivedDone) {
          throw new ApiError(
            'STREAM_INTERRUPTED',
            'The response stream ended unexpectedly before finishing.',
            502,
            {
              provider: activeProvider,
              model: activeModelName,
              retryable: true,
              partialText: fullText.trim() || undefined,
              conversationId: targetConvId,
            }
          );
        }
      } else {
        // Non-streaming JSON response fallback
        const jsonBody: any = await response.json();
        const aiResult = jsonBody?.data !== undefined ? jsonBody.data : jsonBody;
        if (aiResult && aiResult.response) {
          fullText = aiResult.response;
          assistantMsgId = aiResult.messageId || assistantMsgId;
          activeModelName = aiResult.model || modelId;
          activeProvider = aiResult.provider;
          fallbackUsed = Boolean(aiResult.fallbackUsed);
          webSearchMeta = aiResult.webSearch;

          if (aiResult.conversationId) {
            targetConvId = aiResult.conversationId;
            if (userMsg) userMsg.conversationId = targetConvId;
          }
        } else {
          throw new ApiError('EMPTY_AI_RESPONSE', 'Empty AI response received from server.', 502);
        }
      }
    } catch (err: unknown) {
      const formatted = this.formatReadableAiError(err, modelId);

      const isAuthError =
        formatted.code.includes('AUTH') ||
        formatted.code.includes('TOKEN') ||
        formatted.status === 401 ||
        formatted.status === 403;

      const isByokModel = modelId !== 'orbit-agent-v2';

      // Never fall back to simulated responses on auth errors, in production, for BYOK models, or when server returned an ApiError
      if (isAuthError || isProductionEnv() || isByokModel || err instanceof ApiError) {
        const assistantErrorMsg: ChatMessage = {
          id: assistantMsgId,
          conversationId: formatted.conversationId || targetConvId,
          role: 'assistant',
          content: formatted.partialText || '',
          timestamp: new Date().toISOString(),
          modelUsed: modelId,
          provider: formatted.provider,
          status: 'error',
          errorMessage: formatted.message,
          retryable: formatted.retryable,
          isSimulated: false,
        };
        messages.push(assistantErrorMsg);
        if (targetConvId) {
          this.saveMessages(targetConvId, messages);
        }

        throw new ApiError(formatted.code, formatted.message, formatted.status, {
          provider: formatted.provider,
          model: modelId,
          retryable: formatted.retryable,
          partialText: formatted.partialText,
          conversationId: formatted.conversationId || targetConvId,
        });
      }

      // Local fallback in non-production development only when Workers AI binding is unavailable for the default model
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

    // 3. Persist Completed Assistant Message & Stream JSON Fallback if Needed
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      conversationId: targetConvId,
      role: 'assistant',
      content: streamAlreadyRendered ? fullText.trim() : '',
      timestamp: new Date().toISOString(),
      modelUsed: activeModelName,
      provider: activeProvider,
      fallbackUsed,
      actions: proposedActions,
      webSearch: webSearchMeta,
      status: streamAlreadyRendered ? 'complete' : 'streaming',
      isSimulated,
    };

    messages.push(assistantMsg);
    if (targetConvId) {
      this.saveMessages(targetConvId, messages);
    }

    if (streamAlreadyRendered) {
      assistantMsg.content = fullText.trim();
      assistantMsg.status = 'complete';
      onChunk?.(assistantMsg.content, {
        conversationId: targetConvId,
        model: activeModelName,
        provider: activeProvider,
        webSearch: webSearchMeta,
      });
      return assistantMsg;
    }

    // Token-by-token streaming pacing only for non-SSE JSON/local simulated responses
    const words = fullText.split(' ');
    let accumulated = '';
    const chunkSize = 3;
    const delayMs = 35;

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
