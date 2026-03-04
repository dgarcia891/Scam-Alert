-- Add performance indexes for sa_detections and phrase tables

-- Ensure all necessary indexes exist
CREATE INDEX IF NOT EXISTS idx_detections_severity 
  ON sa_detections(overall_severity);

CREATE INDEX IF NOT EXISTS idx_detections_created_at 
  ON sa_detections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_detections_hostname 
  ON sa_detections(hostname);

CREATE INDEX IF NOT EXISTS idx_phrase_severity_label 
  ON phrase(severity_label);

-- Enable pg_trgm extension for faster ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram index for hostname search
CREATE INDEX IF NOT EXISTS idx_detections_hostname_trgm 
  ON sa_detections USING gin (hostname gin_trgm_ops);
