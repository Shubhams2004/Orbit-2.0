import { Task, Project, AgentAction, AgentRun } from '../types';

export interface AgentContextSnapshot {
  tasks: Task[];
  projects: Project[];
  todayDate: string; // '2026-10-14'
}

export interface AgentResponseResult {
  messageContent: string;
  run: AgentRun;
}

export class MockAgentService {
  /**
   * Process prompt against workspace context.
   * Simulates tool execution and generates structured action proposals.
   */
  async processQuery(
    prompt: string,
    context: AgentContextSnapshot
  ): Promise<AgentResponseResult> {
    const runId = `run_${Date.now()}`;
    const normalized = prompt.toLowerCase().trim();

    const overdueTasks = context.tasks.filter(
      (t) => t.dueDate && t.dueDate < context.todayDate && t.status !== 'done'
    );
    const todayTasks = context.tasks.filter(
      (t) => t.dueDate === context.todayDate && t.status !== 'done'
    );
    const activeProjects = context.projects.filter(
      (p) => p.status === 'active' || p.status === 'in_progress'
    );

    let content = '';
    const actions: AgentAction[] = [];
    const toolCallsSummary: string[] = [];

    // Case 1: Plan my day
    if (normalized.includes('plan') && (normalized.includes('day') || normalized.includes('today'))) {
      toolCallsSummary.push(
        'inspect_calendar_context()',
        `query_tasks({ dueDate: "${context.todayDate}", includeOverdue: true })`,
        'compute_daily_energy_distribution()'
      );

      const urgentOverdue = overdueTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');
      
      content = `Here is your structured execution plan for **Wednesday, October 14, 2026**:

### Focus Block 1 (Morning: High Cognitive Load)
- Immediate resolution of urgent items: ${urgentOverdue.length > 0 ? urgentOverdue.map(t => `**${t.title}**`).join(', ') : 'SOC2 Audit validation'}
- Deep work window: Progress on architectural design documents.

### Focus Block 2 (Afternoon: Reviews & Execution)
- Triage ${todayTasks.length} tasks scheduled for today.
- Wrap up open security compliance sign-offs.

I've prepared 2 action items to lock in this plan:`;

      if (overdueTasks.length > 0) {
        actions.push({
          id: `act_${Date.now()}_1`,
          type: 'reschedule_task',
          title: `Reschedule overdue task "${overdueTasks[0].title.slice(0, 38)}..."`,
          description: `Push deadline from ${overdueTasks[0].dueDate} to ${context.todayDate} (Today) to align with daily goals.`,
          data: {
            taskId: overdueTasks[0].id,
            taskTitle: overdueTasks[0].title,
            newDueDate: context.todayDate,
          },
          status: 'proposed',
        });
      }

      actions.push({
        id: `act_${Date.now()}_2`,
        type: 'create_task',
        title: 'Conduct end-of-day workspace recap & backlog grooming',
        description: 'Auto-scheduled 15-minute alignment block at 17:00.',
        data: {
          tasksToCreate: [
            {
              title: 'Daily recap and tomorrow preparation',
              description: 'Review completed items, verify status of active deliverables, and clear inbox.',
              priority: 'medium',
              dueDate: context.todayDate,
              projectId: null,
            },
          ],
        },
        status: 'proposed',
      });
    }
    // Case 2: Find overdue tasks
    else if (normalized.includes('overdue')) {
      toolCallsSummary.push(
        `filter_tasks({ status_neq: "done", dueDate_lt: "${context.todayDate}" })`,
        'calculate_overdue_age_and_risk()'
      );

      if (overdueTasks.length === 0) {
        content = `Great news! There are currently **no overdue tasks** across any of your projects. All deadlines are nominal.`;
      } else {
        content = `Found **${overdueTasks.length} overdue task(s)** requiring immediate review:

${overdueTasks
  .map(
    (t, idx) =>
      `${idx + 1}. **${t.title}**\n   - Original due date: ${t.dueDate}\n   - Priority: ${t.priority.toUpperCase()}\n   - Project: ${context.projects.find((p) => p.id === t.projectId)?.name || 'Unassigned'}`
  )
  .join('\n\n')}

I have prepared rescheduling proposals below to prevent backlog pileup.`;

        overdueTasks.forEach((t, i) => {
          const nextDay = '2026-10-15';
          actions.push({
            id: `act_${Date.now()}_${i}`,
            type: 'reschedule_task',
            title: `Reschedule "${t.title.slice(0, 35)}..." to tomorrow`,
            description: `Shift deadline from ${t.dueDate} to ${nextDay} with High priority.`,
            data: {
              taskId: t.id,
              taskTitle: t.title,
              newDueDate: nextDay,
              newPriority: 'high',
            },
            status: 'proposed',
          });
        });
      }
    }
    // Case 3: Break this project into tasks
    else if (normalized.includes('break') || normalized.includes('decompose') || normalized.includes('into tasks')) {
      const targetProj = activeProjects[0] || context.projects[0];
      toolCallsSummary.push(
        `fetch_project_meta("${targetProj?.id || 'proj_01'}")`,
        'decompose_milestones_into_leaf_tasks()',
        'validate_dependency_order()'
      );

      content = `I analyzed the milestone goals for **${targetProj?.name || 'Platform 2.0 Architecture'}** and identified key actionable deliverables:

1. **Authentication Token Exchange**: Wire edge JWT validation into Cloudflare Worker dispatch.
2. **Telemetry Log Buffering**: Implement client-side batching to minimize network request overhead.
3. **Database Migration Dry Run**: Execute non-destructive schema validation script against test D1 instance.

I have formatted these as structured tasks ready to be added directly into the project backlog:`;

      actions.push({
        id: `act_${Date.now()}_break`,
        type: 'batch_create',
        title: `Create 3 phased subtasks in ${targetProj?.name || 'Active Project'}`,
        description: 'Auto-assign priority and due dates staggered over the next 4 business days.',
        data: {
          tasksToCreate: [
            {
              title: 'Implement edge JWT validation hook',
              description: 'Validates Bearer token format and verifies public keys before dispatch.',
              projectId: targetProj?.id || null,
              priority: 'high',
              dueDate: '2026-10-16',
            },
            {
              title: 'Configure client-side telemetry batching',
              description: 'Debounce activity event dispatches to 300ms intervals.',
              projectId: targetProj?.id || null,
              priority: 'medium',
              dueDate: '2026-10-17',
            },
            {
              title: 'Execute schema dry-run on staging replica',
              description: 'Verify index integrity on task project IDs and user relation keys.',
              projectId: targetProj?.id || null,
              priority: 'high',
              dueDate: '2026-10-19',
            },
          ],
        },
        status: 'proposed',
      });
    }
    // Case 4: Summarize my workload
    else if (normalized.includes('summarize') || normalized.includes('workload') || normalized.includes('status')) {
      toolCallsSummary.push(
        'aggregate_workload_metrics()',
        'compute_priority_ratios()',
        'evaluate_completion_velocity()'
      );

      const totalTasks = context.tasks.length;
      const doneTasks = context.tasks.filter((t) => t.status === 'done').length;
      const inProg = context.tasks.filter((t) => t.status === 'in_progress').length;
      const todoTasks = context.tasks.filter((t) => t.status === 'todo').length;
      const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      content = `### Workload Summary & Health Check

- **Total Tasks**: ${totalTasks}
- **Completed**: ${doneTasks} (${completionRate}%)
- **In Progress**: ${inProg}
- **Pending (To Do)**: ${todoTasks}
- **Overdue**: ${overdueTasks.length}

**Active Projects (${activeProjects.length})**:
${activeProjects.map((p) => `- **${p.name}**: ${context.tasks.filter((t) => t.projectId === p.id && t.status !== 'done').length} pending tasks`).join('\n')}

**Assessment**: Your overall velocity is healthy. Resolving the ${overdueTasks.length} overdue task(s) will bring all workstreams within nominal SLA.`;
    }
    // Case 5: Freeform inquiry
    else {
      toolCallsSummary.push('query_workspace_index()', 'synthesize_recommendation()');

      content = `I received your request: *"${prompt}"*.

I analyzed your workspace context (comprising ${context.tasks.length} tasks across ${context.projects.length} projects). All workspace entities are loaded and indexed.

Would you like me to:
- Schedule a specific task into your calendar?
- Triage today's high priority items?
- Generate an executive summary of current project progression?`;
    }

    const run: AgentRun = {
      id: runId,
      prompt,
      timestamp: new Date().toISOString(),
      status: actions.length > 0 ? 'requires_approval' : 'completed',
      actions,
      toolCallsSummary,
    };

    return {
      messageContent: content,
      run,
    };
  }
}

export const agentService = new MockAgentService();
