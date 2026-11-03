import { FastifyInstance } from 'fastify';
import { prisma } from '@support/database';
import { z } from 'zod';

export async function knowledgeBaseRoutes(fastify: FastifyInstance) {
  // GET /api/v1/knowledge-base
  fastify.get('/knowledge-base', async (request, reply) => {
    const querySchema = z.object({
      category: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(50),
      offset: z.coerce.number().min(0).default(0)
    });

    const { category, limit, offset } = querySchema.parse(request.query);

    const where: any = { isPublished: true };
    if (category) {
      where.category = category;
    }

    const [total, articles] = await Promise.all([
      prisma.knowledgeBaseArticle.count({ where }),
      prisma.knowledgeBaseArticle.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { viewCount: 'desc' }
      })
    ]);

    return reply.status(200).send({
      total,
      limit,
      offset,
      data: articles
    });
  });

  // GET /api/v1/knowledge-base/search
  fastify.get('/knowledge-base/search', async (request, reply) => {
    const querySchema = z.object({
      q: z.string().min(1),
      category: z.string().optional(),
      limit: z.coerce.number().min(1).max(20).default(10)
    });

    const { q, category, limit } = querySchema.parse(request.query);

    const where: any = {
      isPublished: true,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } }
      ]
    };

    if (category) {
      where.category = category;
    }

    const articles = await prisma.knowledgeBaseArticle.findMany({
      where,
      take: limit,
      orderBy: { viewCount: 'desc' }
    });

    return reply.status(200).send({
      query: q,
      count: articles.length,
      data: articles
    });
  });

  // GET /api/v1/knowledge-base/:slug
  fastify.get('/knowledge-base/:slug', async (request, reply) => {
    const paramsSchema = z.object({ slug: z.string() });
    const { slug } = paramsSchema.parse(request.params);

    const article = await prisma.knowledgeBaseArticle.findUnique({
      where: { slug }
    });

    if (!article) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Article '${slug}' not found.`
      });
    }

    // Increment view count asynchronously
    prisma.knowledgeBaseArticle
      .update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } }
      })
      .catch(() => {});

    return reply.status(200).send(article);
  });
}
