import { z } from 'zod';
export interface ToolContext {
    agentId: string;
    authenticatedCustomerId?: string;
    tenantId?: string;
}
export interface ToolDefinition<TParams = any, TResult = any> {
    name: string;
    description: string;
    schema: z.ZodSchema<TParams>;
    ollamaParameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    execute: (params: TParams, context: ToolContext) => Promise<TResult>;
}
export declare const getCustomerProfileTool: ToolDefinition;
export declare const getOrderStatusTool: ToolDefinition;
export declare const searchKnowledgeBaseTool: ToolDefinition;
export declare const createSupportTicketTool: ToolDefinition;
export declare const getPaymentStatusTool: ToolDefinition;
export declare const checkRefundEligibilityTool: ToolDefinition;
export declare const calculateRefundTool: ToolDefinition;
export declare const createRefundRequestTool: ToolDefinition;
export declare const executeApprovedRefundTool: ToolDefinition;
export declare const getOrderDetailsTool: ToolDefinition;
export declare const trackShipmentTool: ToolDefinition;
export declare const requestOrderCancellationTool: ToolDefinition;
export declare const updateDeliveryPreferenceTool: ToolDefinition;
export declare const createEscalationTool: ToolDefinition;
export declare const createSecurityIncidentTool: ToolDefinition;
export declare const requestSupervisorReviewTool: ToolDefinition;
export declare const getTicketHistoryTool: ToolDefinition;
export declare class ToolRegistry {
    private tools;
    constructor();
    register(tool: ToolDefinition): void;
    get(name: string): ToolDefinition | undefined;
    getAll(): ToolDefinition[];
    getForAgent(allowedNames: string[]): ToolDefinition[];
    getOllamaDefinitions(allowedNames: string[]): {
        type: "function";
        function: {
            name: string;
            description: string;
            parameters: {
                type: "object";
                properties: Record<string, any>;
                required?: string[];
            };
        };
    }[];
    executeTool(name: string, args: any, context: ToolContext): Promise<any>;
}
export declare const toolRegistry: ToolRegistry;
