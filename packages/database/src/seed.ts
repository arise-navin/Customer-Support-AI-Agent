import { prisma } from './index.js';

// Deterministic synthetic data generator
const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Dhruv', 'Kabir', 'Rishi', 'Kavya', 'Ananya', 'Diya', 'Isha', 'Aadhya', 'Saanvi', 'Myra',
  'Riya', 'Tanvi', 'Pooja', 'Neha', 'Rohan', 'Vikram', 'Priya', 'Rahul', 'Sunita', 'Amit',
  'Deepak', 'Suresh', 'Manish', 'Kiran', 'Swati', 'Meera', 'Rajesh', 'Anil', 'Sanjay', 'Gaurav'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Mehta', 'Nair', 'Chopra', 'Iyer', 'Gupta', 'Singh',
  'Kumar', 'Joshi', 'Bhat', 'Deshmukh', 'Mukherjee', 'Banerjee', 'Rao', 'Pillai', 'Menon', 'Das'
];

const CITIES = [
  { city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' },
  { city: 'Mumbai', state: 'Maharashtra', postalCode: '400001' },
  { city: 'Delhi', state: 'Delhi', postalCode: '110001' },
  { city: 'Hyderabad', state: 'Telangana', postalCode: '500001' },
  { city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001' },
  { city: 'Pune', state: 'Maharashtra', postalCode: '411001' },
  { city: 'Kolkata', state: 'West Bengal', postalCode: '700001' },
  { city: 'Ahmedabad', state: 'Gujarat', postalCode: '380001' }
];

const CATEGORIES = [
  { name: 'Smartphones & Audio', desc: 'Flagship smartphones, true wireless earbuds, noise-canceling headphones' },
  { name: 'Laptops & Computing', desc: 'Ultrabooks, mechanical keyboards, 4K monitors, ergonomics' },
  { name: 'Smart Home & IoT', desc: 'Security cameras, smart bulbs, automated door locks, smart plugs' },
  { name: 'Wearables & Fitness', desc: 'Smartwatches, heart-rate monitors, smart rings, fitness trackers' },
  { name: 'Kitchen & Appliances', desc: 'Air fryers, espresso machines, robot vacuums, water purifiers' }
];

const KB_ARTICLES = [
  {
    title: 'Standard 30-Day Return & Replacement Policy',
    slug: 'standard-30-day-return-policy',
    category: 'Returns & Refunds',
    tags: ['returns', 'refunds', 'policy', 'replacement'],
    content: `All products purchased through our store are covered by a hassle-free 30-day return policy. Items must be in original condition with intact warranty seals, tags, and authentic packaging. Electronic goods with customer-inflicted water or physical impact damage are not eligible for automated returns. Refunds will be processed back to the original payment method within 3 to 5 business days following warehouse inspection.`
  },
  {
    title: 'Refund Approval Tiers and Authorization Limits',
    slug: 'refund-approval-tiers-limits',
    category: 'Returns & Refunds',
    tags: ['refunds', 'approval', 'limits', 'compliance'],
    content: `To ensure financial safety and regulatory compliance, refunds are processed through strict automated tier validation:\n- Tier 1 (Below INR 2,000): Automated agent processing upon eligibility verification.\n- Tier 2 (INR 2,000 to INR 10,000): Mandatory supervisor review and authorization.\n- Tier 3 (Above INR 10,000): Dual authorization required (Supervisor + Security Operations Review). Duplicate refund requests for the same transaction reference are automatically locked by database constraints.`
  },
  {
    title: 'Order Tracking, Carrier Milestones and Transit Delays',
    slug: 'order-tracking-carrier-milestones',
    category: 'Shipping & Delivery',
    tags: ['tracking', 'shipment', 'delivery', 'delays'],
    content: `Orders are shipped via BlueDart, Delhivery, or FedEx Express. You can track live GPS checkpoints directly using your tracking number (e.g., TRK-...). Transit milestone stages include: LABEL_CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, and DELIVERED. In rare cases of extreme weather or road closures, an EXCEPTION milestone is registered.`
  },
  {
    title: 'Pre-Dispatch Order Cancellation Guidelines',
    slug: 'order-cancellation-guidelines',
    category: 'Order Management',
    tags: ['cancellation', 'orders', 'pre-dispatch'],
    content: `Customers may cancel any order prior to dispatch (status: PENDING or PAID) with 100% full immediate credit to their original payment instrument. Once an order reaches SHIPPED status, the order cannot be intercepted in transit; please refuse delivery or initiate a return upon receipt.`
  },
  {
    title: 'Accepted Payment Methods and Transaction Security',
    slug: 'payment-methods-transaction-security',
    category: 'Billing & Payments',
    tags: ['payments', 'upi', 'cards', 'security'],
    content: `We support instant UPI, RuPay, Visa, Mastercard, American Express, Net Banking, and Wallet credits. All cardholder numbers are strictly tokenized and masked in audit logs. No full credit card credentials or CVVs are ever stored in plain text.`
  }
];

export async function main() {
  console.log('🌱 [Phase 2] Seeding complete synthetic database...');

  // 1. Roles
  const roles = [
    { name: 'ADMIN', description: 'System Administrator', permissions: ['*'] },
    { name: 'SUPERVISOR', description: 'Support Supervisor', permissions: ['refund:approve', 'escalation:resolve'] },
    { name: 'AGENT', description: 'Support Agent', permissions: ['ticket:read', 'ticket:update', 'order:read'] },
    { name: 'CUSTOMER', description: 'Customer', permissions: ['customer:self'] }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role
    });
  }

  // 1.5. Register 4 AI Agents in DB immediately (Required for tests and agent execution)
  console.log('🤖 Registering 4 AI Agents in database...');
  const agentDefs = [
    {
      id: 'support-agent-001',
      name: 'Customer Support Assistant',
      riskTier: 'T3',
      autonomyLevel: 'SEMI_AUTONOMOUS',
      description: 'First point of contact for customer queries, FAQs, and ticket dispatch.',
      systemPrompt: 'You are the Customer Support Assistant (support-agent-001). Answer customer questions politely, look up orders, search knowledge base, and dispatch tickets. Do not attempt direct financial refunds.',
      tools: ['get_customer_profile', 'get_order_status', 'search_knowledge_base', 'create_support_ticket']
    },
    {
      id: 'refund-agent-002',
      name: 'Refund Specialist',
      riskTier: 'T2',
      autonomyLevel: 'SUPERVISED',
      description: 'Evaluates refund eligibility, verifies payments, and issues financial refunds.',
      systemPrompt: 'You are the Refund Specialist (refund-agent-002). Evaluate returns against 30-day policy, enforce approval limits (supervisor approval for >INR 2000, security approval for >INR 10000), and block duplicate returns.',
      tools: ['get_payment_status', 'check_refund_eligibility', 'calculate_refund', 'create_refund_request', 'execute_approved_refund']
    },
    {
      id: 'order-agent-003',
      name: 'Order Management Assistant',
      riskTier: 'T2',
      autonomyLevel: 'SEMI_AUTONOMOUS',
      description: 'Manages shipments, live tracking milestones, and pre-dispatch cancellations.',
      systemPrompt: 'You are the Order Management Assistant (order-agent-003). Provide precise carrier tracking numbers, status updates, and cancellation handling for pre-dispatch orders.',
      tools: ['get_order_details', 'track_shipment', 'request_order_cancellation', 'update_delivery_preference']
    },
    {
      id: 'escalation-agent-004',
      name: 'Escalation Coordinator',
      riskTier: 'T2',
      autonomyLevel: 'SUPERVISED',
      description: 'Coordinates supervisor escalation, handles dispute resolution, and logs security incidents.',
      systemPrompt: 'You are the Escalation Coordinator (escalation-agent-004). Classify escalations, flag suspicious/jailbreak inputs as security incidents, and assign supervisor reviews.',
      tools: ['create_escalation', 'create_security_incident', 'request_supervisor_review', 'get_ticket_history']
    }
  ];

  for (const a of agentDefs) {
    await prisma.aiAgent.upsert({
      where: { id: a.id },
      update: {
        name: a.name,
        riskTier: a.riskTier,
        autonomyLevel: a.autonomyLevel,
        systemPrompt: a.systemPrompt,
        description: a.description
      },
      create: {
        id: a.id,
        name: a.name,
        riskTier: a.riskTier,
        autonomyLevel: a.autonomyLevel,
        status: 'ACTIVE',
        model: 'beam:cloud',
        description: a.description,
        systemPrompt: a.systemPrompt
      }
    });

    for (const tool of a.tools) {
      await prisma.agentToolPermission.upsert({
        where: { agentId_toolName: { agentId: a.id, toolName: tool } },
        update: { isAllowed: true },
        create: { agentId: a.id, toolName: tool, isAllowed: true }
      });
    }
  }

  // 2. Categories
  const createdCategories: any[] = [];
  for (const cat of CATEGORIES) {
    const c = await prisma.productCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name, description: cat.desc }
    });
    createdCategories.push(c);
  }

  // 3. Products (250 items)
  console.log('📦 Seeding 250 products...');
  const existingProductCount = await prisma.product.count();
  if (existingProductCount < 250) {
    const productsToCreate = [];
    for (let i = 1; i <= 250; i++) {
      const cat = createdCategories[i % createdCategories.length];
      const sku = `PROD-${cat.name.substring(0, 3).toUpperCase()}-${String(i).padStart(4, '0')}`;
      const price = Math.round(499 + (i * 137.5) % 45000);
      productsToCreate.push({
        categoryId: cat.id,
        sku,
        name: `${cat.name.split('&')[0].trim()} Pro Max Series ${i}`,
        description: `High-performance industrial grade product model ${i} featuring premium build and extended warranty.`,
        price,
        stockQty: 50 + (i * 7) % 200,
        isActive: true
      });
    }

    await prisma.product.createMany({
      data: productsToCreate,
      skipDuplicates: true
    });
  }

  // 4. Customers (100 synthetic profiles)
  console.log('👥 Seeding 100 synthetic customers...');
  const tiers: ('STANDARD' | 'SILVER' | 'GOLD' | 'VIP')[] = ['STANDARD', 'SILVER', 'GOLD', 'VIP'];
  const customerIndices = Array.from({ length: 100 }, (_, idx) => idx + 1);
  for (let c = 0; c < customerIndices.length; c += 15) {
    const chunk = customerIndices.slice(c, c + 15);
    await Promise.all(chunk.map(async (i) => {
      const firstName = FIRST_NAMES[(i * 3) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length];
      const email = `customer${i}.${firstName.toLowerCase()}.${lastName.toLowerCase()}@signet-customer.internal`;
      const fullName = `${firstName} ${lastName}`;
      const tier = tiers[i % tiers.length];
      const cityInfo = CITIES[i % CITIES.length];

      return prisma.customer.upsert({
        where: { email },
        update: {},
        create: {
          tenantId: 'tenant-support-lab-01',
          email,
          fullName,
          phone: `+91 98${String(10000000 + i * 8372).substring(0, 8)}`,
          tier,
          addresses: {
            create: [
              {
                street: `${100 + i * 2}, Cyber City Road, Sector ${(i % 15) + 1}`,
                city: cityInfo.city,
                state: cityInfo.state,
                postalCode: cityInfo.postalCode,
                country: 'India',
                isDefault: true
              }
            ]
          }
        }
      });
    }));
  }

  const createdCustomers = await prisma.customer.findMany({
    orderBy: { createdAt: 'asc' }
  });

  // 5. Orders (500 orders), Payments (500 payments), Shipments (100 shipments)
  console.log('🛒 Seeding 500 simulated orders and 500 payments...');
  const allProducts = await prisma.product.findMany();
  const existingOrderCount = await prisma.order.count();

  if (existingOrderCount < 500) {
    const orderStatuses = ['PAID', 'DELIVERED', 'SHIPPED', 'PROCESSING', 'CANCELLED', 'REFUNDED'];
    const paymentMethods = ['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING'];
    const carriers = ['BlueDart', 'Delhivery', 'FedEx Express', 'DTDC'];

    const orderIndices = Array.from({ length: 500 }, (_, idx) => idx + 1);
    for (let c = 0; c < orderIndices.length; c += 15) {
      const chunk = orderIndices.slice(c, c + 15);
      await Promise.all(chunk.map(async (i) => {
        const customer = createdCustomers[i % createdCustomers.length];
        const orderNumber = `ORD-${1000 + i}`;
        const status = orderStatuses[i % orderStatuses.length];

        // Pick 1 to 3 items
        const product1 = allProducts[(i * 3) % allProducts.length];
        const product2 = allProducts[(i * 5 + 1) % allProducts.length];
        const qty1 = (i % 2) + 1;
        const qty2 = (i % 3) === 0 ? 1 : 0;

        const subtotal = product1.price * qty1 + (qty2 ? product2.price * qty2 : 0);
        const tax = Math.round(subtotal * 0.18);
        const shipping = subtotal > 5000 ? 0 : 150;
        const totalAmount = subtotal + tax + shipping;

        const order = await prisma.order.upsert({
          where: { orderNumber },
          update: {},
          create: {
            tenantId: 'tenant-support-lab-01',
            orderNumber,
            customerId: customer.id,
            status,
            currency: 'INR',
            subtotal,
            tax,
            shipping,
            totalAmount,
            createdAt: new Date(Date.now() - (500 - i) * 3600000 * 4),
            items: {
              create: [
                {
                  productId: product1.id,
                  productName: product1.name,
                  sku: product1.sku,
                  quantity: qty1,
                  unitPrice: product1.price,
                  totalPrice: product1.price * qty1
                },
                ...(qty2 > 0
                  ? [
                      {
                        productId: product2.id,
                        productName: product2.name,
                        sku: product2.sku,
                        quantity: qty2,
                        unitPrice: product2.price,
                        totalPrice: product2.price * qty2
                      }
                    ]
                  : [])
              ]
            }
          }
        });

        // Simulated Payment for each order
        const method = paymentMethods[i % paymentMethods.length];
        const maskedCard = method.includes('CARD') ? `•••• •••• •••• ${String(1000 + (i * 97) % 9000)}` : null;
        await prisma.payment.upsert({
          where: { transactionRef: `TXN-${orderNumber}-${i}` },
          update: {},
          create: {
            orderId: order.id,
            amount: totalAmount,
            currency: 'INR',
            status: status === 'CANCELLED' ? 'REFUNDED' : 'COMPLETED',
            paymentMethod: method,
            maskedCard,
            transactionRef: `TXN-${orderNumber}-${i}`,
            createdAt: order.createdAt
          }
        });

        // 100 Shipments
        if (i <= 100) {
          const carrier = carriers[i % carriers.length];
          const trackingNumber = `TRK-${carrier.substring(0, 2).toUpperCase()}-${String(700000 + i)}`;
          const shipmentStatus =
            status === 'DELIVERED'
              ? 'DELIVERED'
              : status === 'SHIPPED'
              ? 'IN_TRANSIT'
              : 'LABEL_CREATED';

          await prisma.shipment.upsert({
            where: { orderId: order.id },
            update: {},
            create: {
              orderId: order.id,
              carrier,
              trackingNumber,
              status: shipmentStatus,
              currentLocation: 'Hub Distribution Center, Sector 62',
              estimatedDelivery: new Date(Date.now() + 86400000 * 2),
              trackingHistory: [
                { status: 'LABEL_CREATED', timestamp: order.createdAt.toISOString(), location: 'Central Warehouse' },
                { status: 'PICKED_UP', timestamp: new Date(order.createdAt.getTime() + 7200000).toISOString(), location: 'Origin Facility' },
                { status: shipmentStatus, timestamp: new Date().toISOString(), location: 'Regional Transit Hub' }
              ]
            }
          });
        }
      }));
    }
  }

  // 6. Support Tickets (100 tickets)
  console.log('🎫 Seeding 100 support tickets...');
  const ticketPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const ticketStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const sampleSubjects = [
    'Order delivery delayed beyond expected date',
    'Received wrong variant of smart audio headphones',
    'Question regarding warranty registration',
    'Invoice download request for GST compliance',
    'Product outer carton received with physical dent',
    'How do I pair smart lights with home WiFi gateway?',
    'Billing discrepancy on credit card statement',
    'Request for expedited replacement shipment'
  ];

  const ticketIndices = Array.from({ length: 100 }, (_, idx) => idx + 1);
  for (let c = 0; c < ticketIndices.length; c += 15) {
    const chunk = ticketIndices.slice(c, c + 15);
    await Promise.all(chunk.map(async (i) => {
      const customer = createdCustomers[i % createdCustomers.length];
      const ticketNumber = `TICK-${2000 + i}`;
      const priority = ticketPriorities[i % ticketPriorities.length];
      const status = ticketStatuses[i % ticketStatuses.length];
      const subject = sampleSubjects[i % sampleSubjects.length];

      return prisma.supportTicket.upsert({
        where: { ticketNumber },
        update: {},
        create: {
          tenantId: 'tenant-support-lab-01',
          ticketNumber,
          customerId: customer.id,
          subject: `${subject} (#${i})`,
          description: `Customer ${customer.fullName} opened ticket regarding: ${subject}. Follow up required as per SLA.`,
          priority,
          status,
          assignedAgentId: i % 2 === 0 ? 'support-agent-001' : 'order-agent-003',
          createdAt: new Date(Date.now() - (100 - i) * 3600000 * 8),
          messages: {
            create: [
              {
                senderType: 'CUSTOMER',
                senderId: customer.id,
                message: `Hi, I need urgent assistance regarding my order. ${subject}.`
              },
              {
                senderType: 'AGENT',
                senderId: 'support-agent-001',
                message: `Hello ${customer.fullName}, thank you for contacting support. I am checking the records for you right now.`
              }
            ]
          }
        }
      });
    }));
  }

  // 7. Knowledge Base Articles (30 articles)
  console.log('📚 Seeding 30 knowledge base articles...');
  const kbIndices = Array.from({ length: 30 }, (_, idx) => idx);
  for (let c = 0; c < kbIndices.length; c += 15) {
    const chunk = kbIndices.slice(c, c + 15);
    await Promise.all(chunk.map(async (i) => {
      const base = KB_ARTICLES[i % KB_ARTICLES.length];
      const suffix = i < KB_ARTICLES.length ? '' : ` - Part ${Math.floor(i / KB_ARTICLES.length) + 1}`;
      const slug = `${base.slug}${i >= KB_ARTICLES.length ? `-${i}` : ''}`;
      return prisma.knowledgeBaseArticle.upsert({
        where: { slug },
        update: {},
        create: {
          title: `${base.title}${suffix}`,
          slug,
          category: base.category,
          content: base.content,
          tags: base.tags,
          isPublished: true,
          viewCount: 150 + i * 23
        }
      });
    }));
  }

  // 8. 50 Refund Requests
  console.log('💰 Seeding 50 simulated refund requests...');
  const allOrders = await prisma.order.findMany({
    include: { payments: true },
    take: 60
  });

  const refundReasons = [
    'Product defective upon arrival',
    'Customer cancelled prior to dispatch',
    'Incompatible technical specifications',
    'Item damaged during transit',
    'Duplicate order placed inadvertently'
  ];

  const refundIndices = Array.from({ length: 50 }, (_, idx) => idx);
  for (let c = 0; c < refundIndices.length; c += 15) {
    const chunk = refundIndices.slice(c, c + 15);
    await Promise.all(chunk.map(async (i) => {
      const order = allOrders[i];
      if (!order) return;
      const payment = order.payments[0];
      if (!payment) return;

      const amount = Math.min(order.totalAmount, Math.round(1500 + (i * 850) % 18000));
      const requiresSupervisorApproval = amount > 2000;
      const requiresSecurityApproval = amount > 10000;
      const status = i % 3 === 0 ? 'APPROVED' : i % 3 === 1 ? 'PENDING' : 'REJECTED';

      const req = await prisma.refundRequest.upsert({
        where: { id: `seed-refund-req-${i + 1}` },
        update: {},
        create: {
          id: `seed-refund-req-${i + 1}`,
          tenantId: 'tenant-support-lab-01',
          orderId: order.id,
          customerId: order.customerId,
          amount,
          reason: refundReasons[i % refundReasons.length],
          status,
          requestedBy: 'customer',
          requiresSupervisorApproval,
          requiresSecurityApproval,
          supervisorApprovedAt: status === 'APPROVED' ? new Date() : null,
          securityApprovedAt: status === 'APPROVED' && requiresSecurityApproval ? new Date() : null,
          rejectedReason: status === 'REJECTED' ? 'Product return window exceeded 30-day limit' : null,
          createdAt: new Date(Date.now() - (50 - i) * 3600000 * 6)
        }
      });

      // If approved, create simulated refund execution
      if (status === 'APPROVED') {
        await prisma.refund.upsert({
          where: { refundRequestId: req.id },
          update: {},
          create: {
            refundRequestId: req.id,
            paymentId: payment.id,
            amount,
            currency: 'INR',
            status: 'COMPLETED',
            transactionRef: `REF-TXN-${req.id.substring(0, 8)}-${Date.now() % 100000}`,
            processedAt: new Date()
          }
        });
      }
    }));
  }

  console.log('✅ [Phase 2] Database seeding finished successfully.');
}

if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  main()
    .catch((e) => {
      console.error('❌ Phase 2 Seed Error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
