import { describe, expect, it } from 'vitest';
import { buildApp } from '../apps/backend/src/app.js';
import { prisma } from '@signet/database';

describe('Phase 2 Customer Support Business System Tests', () => {
  const app = buildApp();

  it('should fetch customers from PostgreSQL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/customers?limit=10'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.total).toBeGreaterThanOrEqual(100);
    expect(body.data.length).toBe(10);
    expect(body.data[0]).toHaveProperty('id');
    expect(body.data[0]).toHaveProperty('fullName');
    expect(body.data[0]).toHaveProperty('tier');
  });

  it('should fetch orders correctly linked to customers with items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/orders?limit=5'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.total).toBeGreaterThanOrEqual(500);
    expect(body.data.length).toBe(5);
    const order = body.data[0];
    expect(order.customer).toBeDefined();
    expect(order.items.length).toBeGreaterThan(0);
  });

  it('should fetch carrier tracking for shipped orders', async () => {
    const shipment = await prisma.shipment.findFirst();
    expect(shipment).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/orders/${shipment!.orderId}/tracking`
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.trackingNumber).toBe(shipment!.trackingNumber);
    expect(body.carrier).toBeDefined();
    expect(body.status).toBeDefined();
  });

  it('should create and update a support ticket in PostgreSQL', async () => {
    const customer = await prisma.customer.findFirst();
    expect(customer).toBeDefined();

    // Create ticket
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      payload: {
        customerId: customer!.id,
        subject: 'Automated Test Ticket - Defective Battery',
        description: 'Battery loses charge within 15 minutes of use.',
        priority: 'HIGH'
      }
    });

    expect(createRes.statusCode).toBe(201);
    const ticket = JSON.parse(createRes.payload);
    expect(ticket.ticketNumber).toMatch(/^TICK-/);
    expect(ticket.status).toBe('OPEN');

    // Update ticket
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tickets/${ticket.id}`,
      payload: {
        status: 'RESOLVED',
        replyMessage: 'Battery replacement processed.'
      }
    });

    expect(patchRes.statusCode).toBe(200);
    const updated = JSON.parse(patchRes.payload);
    expect(updated.status).toBe('RESOLVED');
  });

  it('should enforce refund approval thresholds and record approvals', async () => {
    const order = await prisma.order.findFirst({
      where: { status: 'PAID', totalAmount: { gt: 5000 } },
      include: { payments: true }
    });
    expect(order).toBeDefined();

    // Delete any previous refund requests for this order so test is idempotent
    await prisma.refund.deleteMany({
      where: { refundRequest: { orderId: order!.id } }
    });
    await prisma.refundRequest.deleteMany({
      where: { orderId: order!.id }
    });

    // Request refund > INR 2000
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/refunds/request',
      payload: {
        orderId: order!.id,
        customerId: order!.customerId,
        amount: 3500,
        reason: 'Customer initiated return within warranty period.'
      }
    });

    expect(reqRes.statusCode).toBe(201);
    const refundReq = JSON.parse(reqRes.payload);
    expect(refundReq.requiresSupervisorApproval).toBe(true);
    expect(refundReq.status).toBe('PENDING');

    // Approve refund
    const appRes = await app.inject({
      method: 'POST',
      url: `/api/v1/refunds/${refundReq.id}/approve`
    });

    expect(appRes.statusCode).toBe(200);
    const appBody = JSON.parse(appRes.payload);
    expect(appBody.request.status).toBe('APPROVED');
    expect(appBody.refund.status).toBe('COMPLETED');
  });

  it('should block duplicate refund requests for the same order', async () => {
    const existingReq = await prisma.refundRequest.findFirst({
      where: { status: { in: ['PENDING', 'APPROVED'] } }
    });
    expect(existingReq).toBeDefined();

    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/refunds/request',
      payload: {
        orderId: existingReq!.orderId,
        customerId: existingReq!.customerId,
        amount: 500,
        reason: 'Attempting duplicate refund'
      }
    });

    expect(dupRes.statusCode).toBe(409);
  });

  it('should search knowledge base articles', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/knowledge-base/search?q=return'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.count).toBeGreaterThan(0);
    expect(body.data[0].content).toBeDefined();
  });

  it('should deny unauthorized cross-customer order access', async () => {
    const [custA, custB] = await prisma.customer.findMany({ take: 2 });
    const orderB = await prisma.order.findFirst({ where: { customerId: custB.id } });
    expect(orderB).toBeDefined();

    // Customer A attempts to access Customer B's order
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/orders/${orderB!.id}`,
      headers: {
        'x-user-role': 'CUSTOMER',
        'x-customer-id': custA.id
      }
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Access denied');
  });
});
