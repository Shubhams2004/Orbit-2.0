import { Env } from './types';
import { handleOptions, errorResponse, jsonResponse } from './utils/response';
import { authenticateRequest, AuthError } from './middleware/auth';
import {
  handleGetTasks,
  handleCreateTask,
  handleGetTask,
  handlePatchTask,
  handleDeleteTask,
} from './routes/tasks';
import {
  handleGetProjects,
  handleCreateProject,
  handleGetProject,
  handlePatchProject,
  handleDeleteProject,
} from './routes/projects';
import {
  handleGetConversations,
  handleCreateConversation,
  handlePatchConversation,
  handleDeleteConversation,
  handleGetMessages,
} from './routes/conversations';
import { handleAiChat } from './routes/ai';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const pathname = url.pathname;

    // 1. CORS Preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }

    // 2. Health & Status Check
    if (pathname === '/api/v1/health' || pathname === '/health') {
      return jsonResponse({
        status: 'nominal',
        service: 'Orbit 2.0 Cloudflare Workers API',
        version: 'v1',
        environment: env.ENVIRONMENT || 'development',
        hasDbBinding: Boolean(env.DB),
      });
    }

    // 3. Static Assets & SPA Routing
    // Requests outside of /api/ are routed to the frontend SPA via Cloudflare Workers Assets
    if (!pathname.startsWith('/api/')) {
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }
      return new Response('Orbit 2.0 static assets are served via Cloudflare Workers Assets.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 4. API Version Gate (/api/v1/*)
    // Any API route not targeting /api/v1 must return a JSON 404, never an HTML page
    if (!pathname.startsWith('/api/v1/')) {
      return errorResponse(
        'NOT_FOUND',
        `API endpoint '${pathname}' not found. Supported API version is '/api/v1'.`,
        404
      );
    }

    const path = pathname.replace('/api/v1/', '').replace(/\/$/, '');
    const segments = path.split('/');

    try {
      // 4. Authenticate Request & Enforce Identity
      // Identity is derived exclusively from verified credentials, never user-supplied parameters
      const user = await authenticateRequest(request, env);

      // 5. Database Binding Check
      if (!env.DB) {
        return errorResponse(
          'DATABASE_UNAVAILABLE',
          'Cloudflare D1 database binding "DB" is not yet attached to this Worker. Please create your D1 database and bind it via Cloudflare Dashboard (Settings > Bindings > D1) or in wrangler.jsonc.',
          503
        );
      }

      // --- Tasks Endpoints ---
      // GET /api/v1/tasks
      // POST /api/v1/tasks
      if (segments[0] === 'tasks') {
        const taskId = segments[1];

        if (!taskId) {
          if (method === 'GET') return await handleGetTasks(request, env, user);
          if (method === 'POST') return await handleCreateTask(request, env, user);
        } else {
          if (method === 'GET') return await handleGetTask(request, env, user, taskId);
          if (method === 'PATCH') return await handlePatchTask(request, env, user, taskId);
          if (method === 'DELETE') return await handleDeleteTask(request, env, user, taskId);
        }
      }

      // --- Projects Endpoints ---
      // GET /api/v1/projects
      // POST /api/v1/projects
      if (segments[0] === 'projects') {
        const projectId = segments[1];

        if (!projectId) {
          if (method === 'GET') return await handleGetProjects(request, env, user);
          if (method === 'POST') return await handleCreateProject(request, env, user);
        } else {
          if (method === 'GET') return await handleGetProject(request, env, user, projectId);
          if (method === 'PATCH') return await handlePatchProject(request, env, user, projectId);
          if (method === 'DELETE') return await handleDeleteProject(request, env, user, projectId);
        }
      }

      // --- Conversations Endpoints ---
      // GET /api/v1/conversations
      // POST /api/v1/conversations
      if (segments[0] === 'conversations') {
        const conversationId = segments[1];
        const subResource = segments[2];

        if (!conversationId) {
          if (method === 'GET') return await handleGetConversations(request, env, user);
          if (method === 'POST') return await handleCreateConversation(request, env, user);
        } else if (subResource === 'messages') {
          if (method === 'GET') return await handleGetMessages(request, env, user, conversationId);
        } else {
          if (method === 'PATCH') return await handlePatchConversation(request, env, user, conversationId);
          if (method === 'DELETE') return await handleDeleteConversation(request, env, user, conversationId);
        }
      }

      // --- AI Endpoints ---
      // POST /api/v1/ai/chat
      if (segments[0] === 'ai' && segments[1] === 'chat') {
        if (method === 'POST') return await handleAiChat(request, env, user);
        return errorResponse('METHOD_NOT_ALLOWED', `Method ${method} not allowed on ${pathname}`, 405);
      }

      return errorResponse('METHOD_NOT_ALLOWED', `Method ${method} not allowed on ${pathname}`, 405);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        return errorResponse(err.code, err.message, err.status);
      }

      // Safeguard: Never expose internal stack traces or database errors in production
      const isDev = env.ENVIRONMENT === 'development';
      const safeMessage = isDev && err instanceof Error
        ? err.message
        : 'An unexpected internal server error occurred.';

      return errorResponse('INTERNAL_ERROR', safeMessage, 500);
    }
  },
};
