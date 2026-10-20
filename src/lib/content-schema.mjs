import { z } from 'zod';

export const postSchema = z.object({
  title: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, '실제로 존재하는 YYYY-MM-DD 날짜가 필요합니다.'),
  summary: z.string().trim().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  draft: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(60).refine(tag => !/[/\\?%<>:"|*]/.test(tag) && tag !== '.' && tag !== '..', '태그에 파일 경로 구분 문자나 ? % < > : " | * 문자를 사용할 수 없습니다.')).default([]),
});
