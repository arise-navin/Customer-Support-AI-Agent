import { PrismaClient } from '@prisma/client';
declare global {
    var __prisma: PrismaClient | undefined;
}
export declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare function checkDatabaseConnection(): Promise<{
    connected: boolean;
    latencyMs: number;
    error?: string;
}>;
export * from '@prisma/client';
