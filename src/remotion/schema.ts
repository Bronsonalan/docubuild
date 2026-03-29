import { z } from 'zod';

export const transcriptWordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number(),
});

export const edlSchema = z.object({
  segments: z.array(z.object({ start: z.number(), end: z.number() })),
  hooks: z.array(z.object({ text: z.string(), startTime: z.number(), endTime: z.number() })),
  captions: z.array(transcriptWordSchema),
});

export const hookSchema = z.object({
  text: z.string(),
  startTime: z.number(),
  endTime: z.number(),
});

export const docuBuildShortSchema = z.object({
  videoUrl: z.string(),
  edl: edlSchema,
  selectedHook: hookSchema.nullable(),
});

export type DocuBuildShortSchemaProps = z.infer<typeof docuBuildShortSchema>;
