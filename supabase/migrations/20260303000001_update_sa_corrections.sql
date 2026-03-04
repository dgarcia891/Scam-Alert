-- Update sa_corrections table (Add Missing Columns)
-- Check if columns exist first via IF NOT EXISTS in ALTER TABLE

ALTER TABLE sa_corrections 
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

-- Add indexes for faster admin queries
CREATE INDEX IF NOT EXISTS idx_corrections_review_status 
  ON sa_corrections(review_status);

CREATE INDEX IF NOT EXISTS idx_corrections_created_at 
  ON sa_corrections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_corrections_reviewed_by 
  ON sa_corrections(reviewed_by);
