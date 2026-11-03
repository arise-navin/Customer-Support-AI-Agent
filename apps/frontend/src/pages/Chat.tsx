import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Wrench,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  ShieldAlert,
  Plus,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '../lib/api';

export function Chat() {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // 1. Fetch synthetic customers for selection
  const { data: customersData } = useQuery({
    queryKey: ['chat-customers-list'],
    queryFn: async () => {
      const res = await apiRequest<{ data: any[] }>('/customers?limit=20');
      return res.data || [];
    }
  });

  const customers = customersData || [];

  // Set default customer
  useEffect(() => {
    if (!selectedCustomerId && customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  // 2. Fetch conversations for selected customer
  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['conversations', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      return await apiRequest<any[]>(`/chat/conversations?customerId=${selectedCustomerId}`);
    },
    enabled: !!selectedCustomerId
  });

  // Set default conversation
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // 3. Fetch active conversation details and messages
  const { data: activeConv, refetch: refetchActiveConv } = useQuery({
    queryKey: ['conversation-detail', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return null;
      return await apiRequest<any>(`/chat/conversations/${activeConversationId}`);
    },
    enabled: !!activeConversationId,
    refetchInterval: 3000
  });

  const messages = activeConv?.messages || [];

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // 4. Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      setIsSending(true);
      return await apiRequest<any>('/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConversationId || undefined,
          customerId: selectedCustomerId,
          message: messageText
        })
      });
    },
    onSuccess: (data) => {
      setInputMessage('');
      setIsSending(false);
      if (!activeConversationId) {
        setActiveConversationId(data.conversationId);
      }
      refetchConversations();
      refetchActiveConv();
    },
    onError: () => {
      setIsSending(false);
    }
  });

  // 5. Start New Conversation
  const startNewConversation = async () => {
    if (!selectedCustomerId) return;
    try {
      const newConv = await apiRequest<any>('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomerId,
          title: 'New Support Inquiries'
        })
      });
      setActiveConversationId(newConv.id);
      refetchConversations();
    } catch (e) {
      console.error(e);
    }
  };

  const getAgentColor = (agentId: string) => {
    switch (agentId) {
      case 'refund-agent-002':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'order-agent-003':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'escalation-agent-004':
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
    }
  };

  const quickPrompts = [
    'Where is my order ORD-1005?',
    'My product arrived damaged. I want a refund.',
    'I want to speak with a human supervisor.',
    'What is your return policy for electronics?'
  ];

  const selectedCustomerObj = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="h-[calc(100vh-8.5rem)] flex gap-4 max-w-7xl mx-auto">
      {/* Left Sidebar: Conversations & Customer Picker */}
      <div className="w-80 rounded-2xl border border-border bg-card flex flex-col shrink-0 overflow-hidden shadow-sm">
        {/* Customer Selector */}
        <div className="p-4 border-b border-border space-y-2 bg-secondary/30">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Select Synthetic Customer
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => {
              setSelectedCustomerId(e.target.value);
              setActiveConversationId(null);
            }}
            className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.tier})
              </option>
            ))}
          </select>
          {selectedCustomerObj && (
            <div className="text-[11px] text-muted-foreground font-mono truncate">
              {selectedCustomerObj.email}
            </div>
          )}
        </div>

        {/* New Conversation Button */}
        <div className="p-3 border-b border-border">
          <button
            onClick={startNewConversation}
            className="w-full py-2 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Past Conversations ({conversations.length})
          </div>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveConversationId(c.id)}
              className={`w-full text-left p-3 rounded-xl transition-all ${
                activeConversationId === c.id
                  ? 'bg-primary/10 border border-primary/30 text-foreground'
                  : 'hover:bg-secondary/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="font-semibold text-xs truncate">{c.title}</div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                <span>{new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-secondary">
                  {c.activeAgentId}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 rounded-2xl border border-border bg-card flex flex-col overflow-hidden shadow-sm">
        {/* Top Header */}
        <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground flex items-center gap-2">
                <span>Multi-Agent Support Lab</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getAgentColor(activeConv?.activeAgentId || 'support-agent-001')}`}>
                  Active: {activeConv?.activeAgentId || 'support-agent-001'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Autonomous orchestration with instant handoffs between Support, Refund, Order, and Escalation agents.
              </p>
            </div>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground max-w-md mx-auto space-y-2 mt-8">
              <Sparkles className="w-8 h-8 mx-auto text-primary opacity-60" />
              <h3 className="font-bold text-base text-foreground">Welcome to Signet Customer Support AI Lab</h3>
              <p className="text-xs leading-relaxed">
                Send a question or select a prompt below. The orchestrator will route your request directly to the appropriate agent persona, execute tools, and handle handoffs.
              </p>
            </div>
          ) : (
            messages.map((m: any) => {
              const isCustomer = m.sender === 'CUSTOMER';
              return (
                <div key={m.id} className="space-y-2">
                  {/* Handoff Notice Banner */}
                  {m.handoffFrom && m.handoffTo && (
                    <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground py-1">
                      <span className="w-12 h-px bg-border"></span>
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary border border-border text-foreground">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
                        <span>Handoff: {m.handoffFrom} → {m.handoffTo}</span>
                      </span>
                      <span className="w-12 h-px bg-border"></span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`flex gap-3 max-w-2xl ${isCustomer ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 font-bold text-xs ${
                        isCustomer
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {isCustomer ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className="space-y-1">
                      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isCustomer ? 'justify-end' : ''}`}>
                        <span className="font-semibold text-foreground">
                          {isCustomer ? selectedCustomerObj?.fullName || 'Customer' : m.agentId || 'AI Assistant'}
                        </span>
                        <span>•</span>
                        <span className="text-[10px]">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed border ${
                          isCustomer
                            ? 'bg-primary text-primary-foreground rounded-tr-none border-primary/20'
                            : 'bg-secondary/60 text-foreground rounded-tl-none border-border/50'
                        }`}
                      >
                        {m.text}

                        {/* Tool execution badges if present */}
                        {m.toolCallsData && Array.isArray(m.toolCallsData) && m.toolCallsData.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-border/40 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                              Executed Tools ({m.toolCallsData.length})
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {m.toolCallsData.map((tc: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-card/80 text-foreground border border-border flex items-center gap-1"
                                >
                                  <Wrench className="w-3 h-3 text-emerald-500" />
                                  <span>{tc.name}</span>
                                  <span className="text-emerald-500 font-bold text-[9px]">({tc.status})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isSending && (
            <div className="flex gap-3 max-w-xl mr-auto items-center animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-none bg-secondary/60 text-xs text-muted-foreground font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                <span>Agent is reasoning and executing tools with Ollama...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-6 py-2 border-t border-border/50 bg-secondary/20 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-muted-foreground text-[11px] shrink-0 font-medium">Quick Prompts:</span>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setInputMessage(prompt);
                sendMessageMutation.mutate(prompt);
              }}
              disabled={isSending}
              className="px-3 py-1 rounded-full bg-card border border-border text-foreground hover:bg-primary/10 hover:border-primary/30 transition-all shrink-0 text-[11px] disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-border bg-card shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!inputMessage.trim() || isSending) return;
              sendMessageMutation.mutate(inputMessage);
            }}
            className="flex items-center gap-3"
          >
            <input
              type="text"
              placeholder="Ask about orders, request returns, or speak to supervisor..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isSending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Sending...' : 'Send'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
