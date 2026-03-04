-- Create pattern_adjustments table
CREATE TABLE IF NOT EXISTS pattern_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase_id UUID NOT NULL REFERENCES phrase(id) ON DELETE CASCADE,
  correction_id UUID REFERENCES sa_corrections(id) ON DELETE SET NULL,
  old_weight INTEGER NOT NULL,
  new_weight INTEGER NOT NULL,
  adjustment_reason TEXT NOT NULL,
  adjusted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pattern_adjustments_phrase_id ON pattern_adjustments(phrase_id);
CREATE INDEX IF NOT EXISTS idx_pattern_adjustments_created_at ON pattern_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_adjustments_correction_id ON pattern_adjustments(correction_id);

-- Enable RLS
ALTER TABLE pattern_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'pattern_adjustments' AND policyname = 'Admin can view pattern adjustments'
    ) THEN
        CREATE POLICY "Admin can view pattern adjustments"
          ON pattern_adjustments FOR SELECT
          USING (
            EXISTS (
              SELECT 1 FROM az_user_roles 
              WHERE user_id = auth.uid() AND role = 'admin'
            )
          );
    END IF;
END
$$;

-- RLS Policy: Only admins can insert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'pattern_adjustments' AND policyname = 'Admin can insert pattern adjustments'
    ) THEN
        CREATE POLICY "Admin can insert pattern adjustments"
          ON pattern_adjustments FOR INSERT
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM az_user_roles 
              WHERE user_id = auth.uid() AND role = 'admin'
            )
          );
    END IF;
END
$$;
