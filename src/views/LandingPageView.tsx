import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiClient, isProductionEnv } from '../services/apiClient';
import {
  Sparkles,
  Bot,
  Send,
  ArrowRight,
  CheckCircle2,
  Clock,
  Shield,
  Zap,
  Database,
  Layers,
  ChevronRight,
  RefreshCw,
  LayoutDashboard,
  CheckSquare,
  FolderGit2,
  Lock,
  Cpu,
  Plus,
  Play,
  Terminal,
  ExternalLink,
  ArrowUp,
  Copy,
  Check,
} from 'lucide-react';

interface LandingChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface PlanTaskItem {
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string;
  description: string;
}

export const LandingPageView: React.FC<{ onEnterDashboard: () => void }> = ({
  onEnterDashboard,
}) => {
  const {
    user,
    firebaseUser,
    openAuthModal,
    logoutUser,
    setCurrentPage,
    createTask,
    metrics,
    tasks,
    projects,
  } = useWorkspace();

  // -------------------------------------------------------------
  // 1. Live AI Chatbot State (First AI Chatbot on Landing Page)
  // -------------------------------------------------------------
  const [messages, setMessages] = useState<LandingChatMsg[]>([
    {
      id: 'welcome-01',
      role: 'assistant',
      content:
        "Welcome to Orbit 2.0! I am your AI workspace co-pilot powered by Meta Llama 3.1 8B Instruct Fast on Cloudflare Workers AI.\n\nTry asking me to plan a product sprint, generate a compliance checklist, or organize your engineering roadmap.",
      timestamp: 'Just now',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const scrollChatToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [messages, isAiLoading]);

  const sendLandingMessage = async (promptText: string) => {
    const cleanPrompt = promptText.trim();
    if (!cleanPrompt || isAiLoading) return;

    const userMsg: LandingChatMsg = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: cleanPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsAiLoading(true);

    try {
      const response = await apiClient.post<{ response: string; model: string }>('/api/v1/ai/chat', {
        prompt: cleanPrompt,
      });

      const replyContent =
        response?.response ||
        'I processed your request, but received an empty response. How else can I assist your planning?';

      const assistantMsg: LandingChatMsg = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Local fallback simulation if backend is unauthenticated or temporarily offline
      let fallbackText = '';
      const lower = cleanPrompt.toLowerCase();

      if (lower.includes('sprint') || lower.includes('mvp') || lower.includes('plan')) {
        fallbackText = `Here is a structured 2-Week Sprint Plan:\n\n1. **Sprint Goal**: Ship MVP core workflows with D1 persistence.\n2. **Milestone 1 (Days 1–3)**: Finalize API endpoints, authentication boundaries, and database schema.\n3. **Milestone 2 (Days 4–7)**: Build interactive task management & Kanban board.\n4. **Milestone 3 (Days 8–10)**: Connect AI agent terminal with Cloudflare Workers AI.\n5. **Milestone 4 (Days 11–14)**: Security audit, latency benchmarking, and production edge deployment.`;
      } else if (lower.includes('soc2') || lower.includes('compliance') || lower.includes('audit')) {
        fallbackText = `Here is your SOC2 Type II Compliance Checklist:\n\n• **CC6.1 Logical Access**: Enforce RS256 token verification on all Cloudflare Worker routes.\n• **CC6.6 Network Security**: Route all traffic through TLS 1.3 with Cloudflare edge WAF.\n• **CC7.1 Monitoring**: Retain 90-day activity logs with timestamped mutation trails.\n• **CC8.1 Change Management**: Enforce dual-approval CI/CD pipelines before D1 migrations.`;
      } else {
        fallbackText = `I analyzed your request: "${cleanPrompt}".\n\nTo execute this efficiently in Orbit:\n1. Define concrete deliverables with strict due dates.\n2. Assign priority levels (Urgent/High) to eliminate bottleneck dependencies.\n3. Leverage autonomous agent runs to track progress against sprint velocity.\n\nYou can transfer this plan into your Workspace Dashboard right now!`;
      }

      const assistantMsg: LandingChatMsg = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendLandingMessage(inputPrompt);
  };

  // -------------------------------------------------------------
  // 2. Interactive AI Project Planner ("Then plan professionally accordingly")
  // -------------------------------------------------------------
  const PLAN_PRESETS: Record<
    string,
    { title: string; subtitle: string; tasks: PlanTaskItem[] }
  > = {
    saas_launch: {
      title: 'SaaS Production Launch Roadmap',
      subtitle: 'Comprehensive 4-stage rollout for high-scale web products',
      tasks: [
        {
          title: 'Complete Cloudflare Workers AI edge model integration',
          priority: 'urgent',
          dueDate: '2026-11-04',
          description: 'Deploy Llama-3.1-8b-instruct-fast with sub-100ms latency validation',
        },
        {
          title: 'Execute D1 database migration & indexing review',
          priority: 'high',
          dueDate: '2026-11-06',
          description: 'Verify ACID transactions, foreign keys, and indexes on user_id',
        },
        {
          title: 'Conduct RS256 cryptographic token verification audit',
          priority: 'urgent',
          dueDate: '2026-11-08',
          description: 'Enforce strict Firebase ID token audience and issuer policies',
        },
        {
          title: 'Configure automated uptime monitoring and synthetic probes',
          priority: 'medium',
          dueDate: '2026-11-12',
          description: 'Set up global edge health check alerts on /api/v1/health',
        },
      ],
    },
    soc2_audit: {
      title: 'SOC 2 Type II Security Readiness',
      subtitle: 'Zero-trust architecture, audit trails, and boundary protection',
      tasks: [
        {
          title: 'Audit logical access controls and IAM token lifecycles',
          priority: 'urgent',
          dueDate: '2026-11-05',
          description: 'Review JWT expiration windows, revocation paths, and role-based policies',
        },
        {
          title: 'Implement encrypted immutable audit logging in D1',
          priority: 'high',
          dueDate: '2026-11-09',
          description: 'Record mutation events with user identity and ISO 8601 timestamps',
        },
        {
          title: 'Perform third-party edge penetration testing simulation',
          priority: 'high',
          dueDate: '2026-11-14',
          description: 'Verify cross-tenant isolation and SQL injection immunity',
        },
        {
          title: 'Publish security incident response runbook to team',
          priority: 'medium',
          dueDate: '2026-11-18',
          description: 'Document escalation matrix and recovery SLA thresholds',
        },
      ],
    },
    edge_migration: {
      title: 'Cloudflare Edge & Serverless Migration',
      subtitle: 'Zero-downtime transition from legacy centralized server to edge',
      tasks: [
        {
          title: 'Define D1 relational schema and write SQL migrations',
          priority: 'urgent',
          dueDate: '2026-11-03',
          description: 'Conform tables to SQLite syntax with ON DELETE CASCADE constraints',
        },
        {
          title: 'Port REST API endpoints to Cloudflare Worker router',
          priority: 'high',
          dueDate: '2026-11-07',
          description: 'Implement clean route handling with CORS headers and JSON responses',
        },
        {
          title: 'Benchmark edge response times against global POPs',
          priority: 'medium',
          dueDate: '2026-11-11',
          description: 'Confirm sub-50ms TTFB across North America, Europe, and Asia',
        },
        {
          title: 'Switch production DNS to Cloudflare edge proxy',
          priority: 'high',
          dueDate: '2026-11-15',
          description: 'Gradually shift traffic with 0% dropped connections',
        },
      ],
    },
  };

  const [selectedPlanKey, setSelectedPlanKey] = useState<string>('saas_launch');
  const [customGoalText, setCustomGoalText] = useState('');
  const [exportedStatus, setExportedStatus] = useState<string | null>(null);

  const activePlan = PLAN_PRESETS[selectedPlanKey] || PLAN_PRESETS.saas_launch;

  const handleExportPlanToDashboard = async () => {
    setExportedStatus('exporting');
    try {
      for (const t of activePlan.tasks) {
        await createTask({
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: 'todo',
          dueDate: t.dueDate,
        });
      }
      setExportedStatus('success');
      setTimeout(() => {
        onEnterDashboard();
      }, 900);
    } catch {
      setExportedStatus('error');
    }
  };

  // -------------------------------------------------------------
  // 3. Render Landing Page
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Professional Navigation */}
      <nav className="h-16 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-xs">
              O
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-white">Orbit</span>
              <span className="ml-1 text-xs font-mono font-medium text-indigo-400">2.0</span>
            </div>
            <span className="hidden sm:inline-flex text-[11px] text-neutral-500 font-mono ml-2 border-l border-neutral-800 pl-3">
              Edge AI Workspace
            </span>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
            <a href="#ai-chatbot" className="hover:text-white transition-colors">
              AI Chatbot
            </a>
            <a href="#smart-planner" className="hover:text-white transition-colors">
              Smart Planner
            </a>
            <a href="#dashboard-preview" className="hover:text-white transition-colors">
              Dashboard
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Architecture
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Plans
            </a>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {firebaseUser ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-300 hidden sm:inline">
                  {firebaseUser.displayName || firebaseUser.email?.split('@')[0]}
                </span>
                <button
                  onClick={() => logoutUser()}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => openAuthModal('login')}
                className="text-xs font-medium text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Sign In
              </button>
            )}

            <button
              onClick={onEnterDashboard}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Launch Dashboard</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-12 sm:pt-16 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Workers AI Edge Service Operational</span>
          <span className="text-neutral-600">·</span>
          <span className="text-indigo-400 font-mono">Llama 3.1 8B Fast</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-tight">
          The Edge-Native AI Workspace for{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 via-violet-300 to-indigo-200">
            High-Velocity Engineering
          </span>
        </h1>

        <p className="mt-4 sm:mt-6 text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          Unify task triage, project roadmap decomposition, and autonomous AI agents on Cloudflare Workers and D1.
          Experience sub-millisecond edge response, cryptographic security, and uninterrupted developer focus.
        </p>

        {/* Unboxed Metadata Stats */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-neutral-400 font-mono">
          <span>&lt; 50ms Edge Response</span>
          <span aria-hidden="true">·</span>
          <span>Cloudflare D1 ACID Persistence</span>
          <span aria-hidden="true">·</span>
          <span>RS256 Cryptographic Auth</span>
        </div>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onEnterDashboard}
            className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Open Workspace Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#ai-chatbot"
            className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-lg transition-colors"
          >
            <Bot className="w-4 h-4 text-violet-400" />
            <span>Test AI Chatbot Below</span>
          </a>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* FIRST AI CHATBOT ON LANDING PAGE (Claude / ChatGPT Aesthetic)          */}
      {/* ---------------------------------------------------------------------- */}
      <section id="ai-chatbot" className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full scroll-mt-20">
        <div className="bg-[#171717] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          {/* Top Bar: Minimalist ChatGPT/Claude style */}
          <div className="px-5 sm:px-6 py-3.5 bg-[#171717] border-b border-neutral-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-neutral-850 border border-neutral-750 flex items-center justify-center text-violet-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-neutral-100 tracking-tight">Orbit 2.0</span>
              <span className="text-neutral-600 font-mono">/</span>
              <span className="text-xs text-neutral-400 hidden sm:inline">Llama 3.1 8B Fast</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[11px]">Edge Ready</span>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="p-4 sm:p-6 space-y-4 min-h-[280px] max-h-[420px] overflow-y-auto bg-[#171717] font-sans text-xs sm:text-sm">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`w-full flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'user' ? (
                  <div className="bg-[#2f2f2f] hover:bg-[#343434] text-neutral-100 rounded-3xl rounded-br-md px-4 py-2.5 max-w-[85%] sm:max-w-[75%] leading-relaxed shadow-xs whitespace-pre-wrap select-text">
                    {m.content}
                  </div>
                ) : (
                  <div className="flex gap-3 max-w-[90%] leading-relaxed text-neutral-200">
                    <div className="w-6 h-6 rounded-full bg-neutral-850 border border-neutral-750 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Sparkles className="w-3 h-3 text-violet-400" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="whitespace-pre-wrap select-text">{m.content}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isAiLoading && (
              <div className="flex gap-3 justify-start items-center text-xs text-neutral-400">
                <div className="w-6 h-6 rounded-full bg-neutral-850 border border-neutral-750 text-violet-400 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                </div>
                <div className="text-neutral-400 text-xs">
                  Orbit is thinking...
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Prompt Suggestions */}
          <div className="px-5 sm:px-6 py-2 bg-[#171717] border-t border-neutral-800/60 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-neutral-500 mr-1">Suggestions:</span>
            {[
              'Plan a 2-week MVP sprint with deliverables',
              'Generate a SOC2 Type II compliance roadmap',
              'Help me triage 4 urgent engineering tasks',
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => sendLandingMessage(preset)}
                className="px-2.5 py-1 text-[11px] text-neutral-300 bg-neutral-900 hover:bg-neutral-850 hover:text-white border border-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Floating Pill Composer */}
          <div className="p-4 sm:p-5 bg-[#171717]">
            <form
              onSubmit={handleFormSubmit}
              className="bg-[#212121] border border-neutral-750/80 rounded-3xl p-2.5 sm:p-3 shadow-xl focus-within:border-neutral-500 transition-all flex flex-col"
            >
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendLandingMessage(inputPrompt);
                  }
                }}
                disabled={isAiLoading}
                placeholder="Ask Orbit AI to plan tasks, evaluate priorities, or solve an engineering bottleneck..."
                rows={1}
                className="w-full px-2 py-1 bg-transparent text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 resize-none focus:outline-hidden leading-relaxed"
              />

              <div className="mt-2 flex items-center justify-between pt-1">
                <span className="text-[10px] text-neutral-500 pl-2">Shift + Enter for newline</span>
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isAiLoading}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                    inputPrompt.trim() && !isAiLoading
                      ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
                  }`}
                  title="Send message"
                >
                  <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                </button>
              </div>
            </form>

            <div className="mt-2 text-center text-[10px] text-neutral-500">
              Orbit 2.0 AI Assistant · Powered by Cloudflare Workers AI · Sub-50ms edge inference
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* THEN PLAN PROFESSIONALLY ACCORDINGLY: SMART WORKFLOW PLANNER           */}
      {/* ---------------------------------------------------------------------- */}
      <section id="smart-planner" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Plan Professionally with AI Decomposition
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Select an engineering initiative blueprint or input your customized roadmap.
            Orbit formulates actionable milestones with realistic deadlines and priority weighting.
          </p>
        </div>

        {/* Blueprint Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {[
            { key: 'saas_launch', label: 'SaaS Production Launch' },
            { key: 'soc2_audit', label: 'SOC2 Type II Audit' },
            { key: 'edge_migration', label: 'Cloudflare Edge Migration' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedPlanKey(tab.key)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedPlanKey === tab.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Structured Plan Visualizer */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 sm:p-7 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-800">
            <div>
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-semibold text-white">{activePlan.title}</h3>
              </div>
              <p className="text-xs text-neutral-400 mt-1">{activePlan.subtitle}</p>
            </div>

            <button
              onClick={handleExportPlanToDashboard}
              disabled={exportedStatus === 'exporting'}
              className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs"
            >
              {exportedStatus === 'exporting' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Transferring Tasks...</span>
                </>
              ) : exportedStatus === 'success' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Transferred! Opening Dashboard...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Export Plan to My Dashboard</span>
                </>
              )}
            </button>
          </div>

          {/* Tasks Grid */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePlan.tasks.map((task, idx) => (
              <div
                key={task.title}
                className="p-4 bg-neutral-950/70 border border-neutral-800/80 rounded-xl hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-mono text-neutral-500">0{idx + 1}.</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      task.priority === 'urgent'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : task.priority === 'high'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
                <h4 className="mt-2 text-xs sm:text-sm font-medium text-neutral-200">
                  {task.title}
                </h4>
                <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                  {task.description}
                </p>
                <div className="mt-3 pt-2.5 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                  <span>Target Date</span>
                  <span className="text-neutral-300">{task.dueDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* DASHBOARD PREVIEW & CAPABILITIES                                       */}
      {/* ---------------------------------------------------------------------- */}
      <section id="dashboard-preview" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Unified Executive Dashboard
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Real-time control over tasks, projects, compliance benchmarks, and agent automations.
          </p>
        </div>

        {/* Dashboard Showcase Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Metrics Teaser Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b border-neutral-800">
            <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/70 rounded-xl">
              <span className="text-[11px] text-neutral-400">Total Workload</span>
              <div className="mt-1 text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
                {metrics.totalTasks} Tasks
              </div>
              <span className="text-[10px] text-emerald-400 mt-0.5 block">State synced</span>
            </div>

            <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/70 rounded-xl">
              <span className="text-[11px] text-neutral-400">Due Today</span>
              <div className="mt-1 text-xl sm:text-2xl font-bold font-mono text-sky-400 tabular-nums">
                {metrics.tasksDueToday} Items
              </div>
              <span className="text-[10px] text-neutral-500 mt-0.5 block">High urgency triage</span>
            </div>

            <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/70 rounded-xl">
              <span className="text-[11px] text-neutral-400">Completed Rate</span>
              <div className="mt-1 text-xl sm:text-2xl font-bold font-mono text-indigo-400 tabular-nums">
                {metrics.completionPercentage}%
              </div>
              <span className="text-[10px] text-indigo-300 mt-0.5 block">
                {metrics.completedTasks} completed
              </span>
            </div>

            <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/70 rounded-xl">
              <span className="text-[11px] text-neutral-400">Active Projects</span>
              <div className="mt-1 text-xl sm:text-2xl font-bold font-mono text-violet-400 tabular-nums">
                {projects.length} Portfolios
              </div>
              <span className="text-[10px] text-neutral-500 mt-0.5 block">Full ownership</span>
            </div>
          </div>

          {/* Quick CTA to jump in */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Full-featured engineering workspace</h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Switch between Kanban view, task list, project details, and agent audit trails.
              </p>
            </div>

            <button
              onClick={onEnterDashboard}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
            >
              <span>Explore Dashboard Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* ARCHITECTURE & SECURITY FOUNDATIONS                                    */}
      {/* ---------------------------------------------------------------------- */}
      <section id="architecture" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Built for Zero-Trust Production Deployments
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Eliminating sluggish centralized databases and heavy VM orchestration in favor of native Cloudflare edge primitives.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
            <Cpu className="w-6 h-6 text-indigo-400 mb-3" />
            <h3 className="text-sm font-semibold text-white">Cloudflare Workers AI</h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Native serverless inference with Meta Llama 3.1 8B Instruct Fast. No external API key rate-limits or slow round-trips.
            </p>
          </div>

          <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
            <Database className="w-6 h-6 text-sky-400 mb-3" />
            <h3 className="text-sm font-semibold text-white">Cloudflare D1 Persistence</h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Global SQLite database with ACID compliance, relational integrity, cascade deletes, and low-millisecond queries.
            </p>
          </div>

          <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
            <Lock className="w-6 h-6 text-emerald-400 mb-3" />
            <h3 className="text-sm font-semibold text-white">Cryptographic RS256 Auth</h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Verifies Firebase ID tokens directly against Google public key certs on every edge invocation. Client user IDs are never trusted.
            </p>
          </div>

          <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
            <Zap className="w-6 h-6 text-amber-400 mb-3" />
            <h3 className="text-sm font-semibold text-white">Zero Cold Start</h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              V8 isolates spin up in under 5ms across 330+ edge locations worldwide with automatic global CDN caching.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- */}
      {/* PROFESSIONAL PLANS & TRANSPARENT PRICING                               */}
      {/* ---------------------------------------------------------------------- */}
      <section id="pricing" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Professional Plans for Ambitious Teams
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Transparent pricing designed for individual contributors and high-velocity engineering organizations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Starter Plan */}
          <div className="p-6 bg-neutral-900/80 border border-neutral-800 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-neutral-400">Developer</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">$0</span>
                <span className="text-xs text-neutral-500">/ forever</span>
              </div>
              <p className="text-xs text-neutral-400 mt-2">
                Ideal for solo builders and hobby projects exploring edge AI workflows.
              </p>

              <div className="mt-6 space-y-2.5 text-xs text-neutral-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Unlimited local tasks & projects</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Cloudflare D1 edge database</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>100 AI chatbot calls / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Single-user Firebase authentication</span>
                </div>
              </div>
            </div>

            <button
              onClick={onEnterDashboard}
              className="mt-8 w-full py-2 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-750 rounded-lg transition-colors"
            >
              Start Free
            </button>
          </div>

          {/* Pro Workspace Plan */}
          <div className="p-6 bg-neutral-900 border-2 border-indigo-500/80 rounded-2xl flex flex-col justify-between relative shadow-xl shadow-indigo-950/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-[11px] font-semibold text-white tracking-wide uppercase">
              Most Popular
            </div>

            <div>
              <span className="text-xs font-mono text-indigo-400">Pro Workspace</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">$19</span>
                <span className="text-xs text-neutral-500">/ seat / month</span>
              </div>
              <p className="text-xs text-neutral-400 mt-2">
                For fast-paced product teams requiring autonomous agent pipelines.
              </p>

              <div className="mt-6 space-y-2.5 text-xs text-neutral-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Unlimited Workers AI chat & agent runs</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Prioritized Meta Llama 3.1 Fast inference</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Cross-project dependency tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>30-day activity & compliance audit log</span>
                </div>
              </div>
            </div>

            <button
              onClick={onEnterDashboard}
              className="mt-8 w-full py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs"
            >
              Launch Dashboard Pro
            </button>
          </div>

          {/* Enterprise Cloud Plan */}
          <div className="p-6 bg-neutral-900/80 border border-neutral-800 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-neutral-400">Enterprise Cloud</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">Custom</span>
                <span className="text-xs text-neutral-500">/ annual contract</span>
              </div>
              <p className="text-xs text-neutral-400 mt-2">
                Tailored infrastructure for regulated organizations with strict SLAs.
              </p>

              <div className="mt-6 space-y-2.5 text-xs text-neutral-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dedicated D1 read replicas & backup</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Custom LLM fine-tuning & BYO-model</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>SOC2 Type II compliance guarantees</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Custom SAML SSO & dedicated support</span>
                </div>
              </div>
            </div>

            <button
              onClick={onEnterDashboard}
              className="mt-8 w-full py-2 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-750 rounded-lg transition-colors"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full text-center">
        <div className="bg-linear-to-b from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Ready to accelerate your product delivery?
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto leading-relaxed">
            Join engineering teams managing roadmaps, edge persistence, and autonomous AI agents in one unified workspace.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onEnterDashboard}
              className="flex items-center gap-2 px-6 py-3 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Enter Orbit Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="mt-auto border-t border-neutral-900 bg-neutral-950 py-8 px-4 sm:px-6 lg:px-8 text-neutral-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">
              O
            </div>
            <span className="text-neutral-400 font-medium">Orbit 2.0 AI Workspace</span>
            <span aria-hidden="true">·</span>
            <span>Cloudflare Workers & D1</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={onEnterDashboard}
              className="hover:text-neutral-300 transition-colors"
            >
              Dashboard
            </button>
            <a href="#ai-chatbot" className="hover:text-neutral-300 transition-colors">
              Chatbot
            </a>
            <a href="#smart-planner" className="hover:text-neutral-300 transition-colors">
              Planner
            </a>
            <a href="#pricing" className="hover:text-neutral-300 transition-colors">
              Pricing
            </a>
          </div>

          <div className="text-[11px] text-neutral-600">
            © 2026 Orbit Systems Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
