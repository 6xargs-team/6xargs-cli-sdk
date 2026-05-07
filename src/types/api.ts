import { z } from "zod";

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    error: z.string().optional(),
    request_id: z.string().optional(),
  });

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  version: z.string().optional(),
  timestamp: z.string().optional(),
});

export const AuthTokenResponseSchema = z.object({
  jwt: z.string(),
  expires_at: z.string(),
  firm: z.object({
    id: z.string(),
    name: z.string(),
    plan: z.enum(["starter", "pro", "enterprise"]),
  }),
});

export const IngestionJobSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  filename: z.string(),
  created_at: z.string(),
  completed_at: z.string().optional(),
  error: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const EngagementSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string().optional(),
  stack: z.array(z.string()).optional(),
  indexed_at: z.string(),
  findings_count: z.number().optional(),
});

export const QueryResultSchema = z.object({
  id: z.string(),
  answer: z.string(),
  sources: z.array(
    z.object({
      engagement_id: z.string(),
      relevance: z.number(),
      snippet: z.string().optional(),
    })
  ),
  mode: z.enum(["guide", "report"]),
  latency_ms: z.number().optional(),
});

export const FirmSchema = z.object({
  id: z.string(),
  name: z.string(),
  plan: z.enum(["starter", "pro", "enterprise"]),
  engagements_indexed: z.number(),
  queries_this_month: z.number(),
  created_at: z.string(),
});

export const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  created_at: z.string(),
  last_used_at: z.string().optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;
export type IngestionJob = z.infer<typeof IngestionJobSchema>;
export type Engagement = z.infer<typeof EngagementSchema>;
export type QueryResult = z.infer<typeof QueryResultSchema>;
export type Firm = z.infer<typeof FirmSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;

export const QueryHistoryItemSchema = z.object({
  id: z.string(),
  query: z.string(),
  mode: z.enum(["guide", "report"]),
  created_at: z.string(),
  useful: z.boolean().optional(),
});

export const QueryHistorySchema = z.object({
  items: z.array(QueryHistoryItemSchema),
  total: z.number().optional(),
});

export const FeedbackResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type QueryHistoryItem = z.infer<typeof QueryHistoryItemSchema>;
export type QueryHistory = z.infer<typeof QueryHistorySchema>;
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;

export const NewApiKeySchema = ApiKeySchema.extend({
  key: z.string(),
});
export type NewApiKey = z.infer<typeof NewApiKeySchema>;
