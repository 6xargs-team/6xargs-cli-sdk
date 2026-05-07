import { z } from "zod";

export const PlanSchema = z.enum(["starter", "pro", "enterprise"]);

export const OutputFormatSchema = z.enum(["table", "json", "yaml", "raw"]);

export const ProfileSchema = z.object({
  username: z.string().optional(),
  api_key: z.string().optional(),
  jwt: z.string().optional(),
  jwt_expires_at: z.string().optional(),
  api_base: z.string().default("https://api.6xargs.com"),
  firm_id: z.string().optional(),
  firm_name: z.string().optional(),
  plan: PlanSchema.optional(),
  output_format: OutputFormatSchema.default("table"),
});

export const ConfigSchema = z.object({
  current_profile: z.string().default("default"),
  profiles: z.record(z.string(), ProfileSchema).default({
    default: ProfileSchema.parse({}),
  }),
});

export type Plan = z.infer<typeof PlanSchema>;
export type OutputFormat = z.infer<typeof OutputFormatSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Config = z.infer<typeof ConfigSchema>;
