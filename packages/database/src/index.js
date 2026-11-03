"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.checkDatabaseConnection = checkDatabaseConnection;
const client_1 = require("@prisma/client");
exports.prisma = globalThis.__prisma ||
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = exports.prisma;
}
async function checkDatabaseConnection() {
    const start = Date.now();
    try {
        await exports.prisma.$queryRaw `SELECT 1 as result`;
        return {
            connected: true,
            latencyMs: Date.now() - start
        };
    }
    catch (err) {
        return {
            connected: false,
            latencyMs: Date.now() - start,
            error: err?.message || 'Database connection failed'
        };
    }
}
__exportStar(require("@prisma/client"), exports);
//# sourceMappingURL=index.js.map