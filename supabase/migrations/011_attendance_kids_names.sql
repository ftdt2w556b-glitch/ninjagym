-- Store kids names directly in attendance log so top-up check-ins also show the correct names
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS kids_names text;
