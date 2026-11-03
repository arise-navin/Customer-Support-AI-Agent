import { prisma } from '@support/database';
import { agentRegistry, agentRunner, AgentRunResult } from './index.js';
import { toolRegistry } from '@support/tools';

export interface OrchestrationEvent {
  type: 'agent_selected' | 'handoff' | 'tool_call' | 'approval_required' | 'chunk' | 'done' | 'error';
  agentId?: string;
  agentName?: string;
  handoffFrom?: string;
  handoffTo?: string;
  reason?: string;
  toolName?: string;
  toolStatus?: string;
  content?: string;
  data?: any;
}

export interface DispatchMessageOptions {
  conversationId?: string;
  customerId: string;
  userMessage: string;
  preferredAgentId?: string;
  modelService: any;
  onEvent?: (event: OrchestrationEvent) => void;
}

export class AgentOrchestrator {
  private maxHops = 4;

  // Classify intent to determine whether to handoff or keep current agent
  classifyIntent(message: string, currentAgentId: string): { targetAgentId: string; reason?: string } {
    const text = message.toLowerCase();

    // 1. Escalation / Supervisor / Emergency
    if (
      text.includes('supervisor') ||
      text.includes('escalat') ||
      text.includes('manager') ||
      text.includes('human') ||
      text.includes('lawyer') ||
      text.includes('complaint') ||
      text.includes('jailbreak') ||
      text.includes('ignore previous instructions')
    ) {
      if (currentAgentId !== 'escalation-agent-004') {
        return {
          targetAgentId: 'escalation-agent-004',
          reason: 'Customer requested human supervisor, manager escalation, or flagged priority dispute.'
        };
      }
    }

    // 2. Refund / Return / Damage / Money Back
    if (
      text.includes('refund') ||
      text.includes('return') ||
      text.includes('money back') ||
      text.includes('damaged') ||
      text.includes('defective') ||
      text.includes('overcharged')
    ) {
      if (currentAgentId !== 'refund-agent-002') {
        return {
          targetAgentId: 'refund-agent-002',
          reason: 'Customer inquiring about returns, item damage, or financial refund processing.'
        };
      }
    }

    // 3. Order Management / Tracking / Shipment / Cancellation
    if (
      text.includes('where is my order') ||
      text.includes('track') ||
      text.includes('shipment') ||
      text.includes('carrier') ||
      text.includes('delivery status') ||
      text.includes('cancel order') ||
      text.includes('cancellation') ||
      /\bord-\d+\b/i.test(text)
    ) {
      if (currentAgentId !== 'order-agent-003' && currentAgentId !== 'refund-agent-002') {
        return {
          targetAgentId: 'order-agent-003',
          reason: 'Customer inquiring about shipment tracking, carrier location, or order cancellation.'
        };
      }
    }

    // Default: Support Assistant
    return { targetAgentId: currentAgentId || 'support-agent-001' };
  }

  async dispatchMessage(options: DispatchMessageOptions): Promise<{
    conversationId: string;
    activeAgentId: string;
    response: string;
    handoff?: { from: string; to: string; reason: string };
    toolCalls: any[];
    approvalRequired?: boolean;
    durationMs: number;
  }> {
    const start = Date.now();
    const emit = options.onEvent || (() => {});

    // 1. Fetch or create conversation
    let conversation: any;
    if (options.conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: options.conversationId },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 10 }
        }
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          customerId: options.customerId,
          title: options.userMessage.substring(0, 40) + '...',
          activeAgentId: options.preferredAgentId || 'support-agent-001'
        },
        include: { messages: true }
      });
    }

    const currentAgentId = conversation.activeAgentId;

    // 2. Save user message to database
    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        sender: 'CUSTOMER',
        text: options.userMessage
      }
    });

    // 3. Determine if an agent-to-agent handoff is required
    const routing = this.classifyIntent(options.userMessage, currentAgentId);
    let activeAgentId = routing.targetAgentId;
    let handoffInfo: any = null;

    if (routing.targetAgentId !== currentAgentId) {
      handoffInfo = {
        from: currentAgentId,
        to: routing.targetAgentId,
        reason: routing.reason || 'Workflow routed to specialist agent.'
      };

      // Record handoff in PostgreSQL
      await prisma.agentHandoff.create({
        data: {
          conversationId: conversation.id,
          fromAgentId: currentAgentId,
          toAgentId: routing.targetAgentId,
          reason: handoffInfo.reason
        }
      });

      // Update active agent on conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { activeAgentId: routing.targetAgentId }
      });

      emit({
        type: 'handoff',
        handoffFrom: currentAgentId,
        handoffTo: routing.targetAgentId,
        reason: handoffInfo.reason
      });
    }

    emit({
      type: 'agent_selected',
      agentId: activeAgentId,
      agentName: agentRegistry.getAgent(activeAgentId)?.name
    });

    // 4. Build conversation history for agent
    const history = (conversation.messages || []).map((m: any) => ({
      role: m.sender === 'CUSTOMER' ? ('user' as const) : ('assistant' as const),
      content: m.text
    }));

    // 5. Execute AgentRunner
    const runResult = await agentRunner.run({
      agentId: activeAgentId,
      userMessage: options.userMessage,
      authenticatedCustomerId: options.customerId,
      conversationId: conversation.id,
      conversationHistory: history,
      modelService: options.modelService
    });

    // Emit tool calls
    for (const tc of runResult.toolCallsExecuted) {
      emit({
        type: 'tool_call',
        toolName: tc.name,
        toolStatus: tc.status,
        data: tc.result
      });
    }

    // Check if any tool triggered pending supervisor review / approval
    const approvalRequired = runResult.toolCallsExecuted.some(({ result }) => {
      if (result === null || typeof result !== 'object' || Array.isArray(result)) return false;
      return result.requiresSupervisorApproval === true || result.status === 'QUEUED_FOR_SUPERVISOR' || result.status === 'PENDING';
    });

    if (approvalRequired) {
      emit({
        type: 'approval_required',
        agentId: activeAgentId,
        reason: 'Action exceeds autonomous threshold and requires supervisor authorization.'
      });
    }

    // 6. Save assistant message to conversation
    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        sender: 'AGENT',
        agentId: activeAgentId,
        text: runResult.response,
        toolCallsData: runResult.toolCallsExecuted as any,
        handoffFrom: handoffInfo?.from,
        handoffTo: handoffInfo?.to
      }
    });

    emit({
      type: 'done',
      content: runResult.response
    });

    return {
      conversationId: conversation.id,
      activeAgentId,
      response: runResult.response,
      handoff: handoffInfo || undefined,
      toolCalls: runResult.toolCallsExecuted,
      approvalRequired,
      durationMs: Date.now() - start
    };
  }
}

export const agentOrchestrator = new AgentOrchestrator();
