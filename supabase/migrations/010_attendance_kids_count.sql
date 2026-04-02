-- Add kids_count to attendance_logs so check-in totals reflect actual people checked in
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS kids_count integer NOT NULL DEFAULT 1;
