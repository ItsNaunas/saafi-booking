-- 2026-09-15 cleaner SOP checklist — one paste. Safe to run twice.
--
-- What the cleaner ticked off on the job, written once when they press
-- Finish. The list itself lives in code (lib/checklist.ts) — only the keys
-- ticked are stored, so an SOP edit never rewrites history: a checklist
-- saved today still reads correctly next year, and anything the code no
-- longer recognises is simply not shown.
--
-- Shape: {"v":1,"done":["s.kit.worktops", ...],"total":43,"at":"2026-09-15T..."}
--
-- NULL on every job finished before this existed, and on any job where the
-- save failed — the write is deliberately best-effort, because losing a
-- checklist must never lose a Finish.

alter table bookings add column if not exists checklist jsonb;

comment on column bookings.checklist is
  'SOP checklist at Finish: {v, done[], total, at}. Keys from lib/checklist.ts.';
