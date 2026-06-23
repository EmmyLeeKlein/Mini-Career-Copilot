-- The "Generate More Questions" button appends questions past the initial
-- 5, so the original 1-5 cap on question_index was wrong. Drop the upper
-- bound, keep the lower bound and per-kit uniqueness.
alter table public.kit_questions
  drop constraint kit_questions_question_index_check;

alter table public.kit_questions
  add constraint kit_questions_question_index_check check (question_index >= 1);
