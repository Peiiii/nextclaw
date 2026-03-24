import { z } from "zod";

const allowFromSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return [];
    }
    if (typeof value === "string") {
      return [value];
    }
    return value;
  }, z.array(z.string()))
  .default([]);

const domainSchema = z
  .string()
  .refine((value) => value === "feishu" || value === "lark" || value.startsWith("https://"), {
    message: "Domain must be 'feishu', 'lark', or a custom https:// URL"
  })
  .default("feishu");

export const FeishuGroupRuleSchema = z.object({
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional(),
  requireMention: z.boolean().default(false),
  mentionPatterns: z.array(z.string()).default([])
});

export const FeishuAccountConfigSchema = z.object({
  enabled: z.boolean().default(false),
  name: z.string().default(""),
  appId: z.string().default(""),
  appSecret: z.string().default(""),
  encryptKey: z.string().default(""),
  verificationToken: z.string().default(""),
  domain: domainSchema,
  allowFrom: allowFromSchema,
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).default("open"),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).default("open"),
  groupAllowFrom: allowFromSchema,
  requireMention: z.boolean().default(false),
  mentionPatterns: z.array(z.string()).default([]),
  groups: z.record(z.string(), FeishuGroupRuleSchema).default({}),
  textChunkLimit: z.number().int().min(1).default(4000),
  mediaMaxMb: z.number().int().min(1).default(20),
  threadSession: z.boolean().default(false),
  extra: z
    .object({
      domain: z.string().optional(),
      httpHeaders: z.record(z.string(), z.string()).optional()
  })
    .default({})
});

export const FeishuAccountOverrideSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  encryptKey: z.string().optional(),
  verificationToken: z.string().optional(),
  domain: domainSchema.optional(),
  allowFrom: allowFromSchema.optional(),
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional(),
  groupAllowFrom: allowFromSchema.optional(),
  requireMention: z.boolean().optional(),
  mentionPatterns: z.array(z.string()).optional(),
  groups: z.record(z.string(), FeishuGroupRuleSchema).optional(),
  textChunkLimit: z.number().int().min(1).optional(),
  mediaMaxMb: z.number().int().min(1).optional(),
  threadSession: z.boolean().optional(),
  extra: z
    .object({
      domain: z.string().optional(),
      httpHeaders: z.record(z.string(), z.string()).optional()
    })
    .optional()
});

export const FeishuConfigSchema = FeishuAccountConfigSchema.extend({
  accounts: z.record(z.string(), FeishuAccountOverrideSchema).default({})
}).superRefine((data, ctx) => {
  if (data.dmPolicy === "open" && !data.allowFrom.includes("*") && data.allowFrom.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowFrom"],
      message: 'When dmPolicy is "open", allowFrom should include "*" if you intend to allow every sender.'
    });
  }
});

export type FeishuGroupRule = z.infer<typeof FeishuGroupRuleSchema>;
export type FeishuAccountConfig = z.infer<typeof FeishuAccountConfigSchema>;
export type FeishuAccountOverride = z.infer<typeof FeishuAccountOverrideSchema>;
export type FeishuConfig = z.infer<typeof FeishuConfigSchema>;
