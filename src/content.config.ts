import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { postSchema } from './lib/content-schema.mjs';
export const collections = {
  posts: defineCollection({
    loader: glob({ pattern: '*/index.{md,mdx}', base: './src/content/posts' }),
    schema: postSchema,
  }),
};
