-- Add stage_assigned_at column to track when a conversation was assigned to a pipeline stage
-- This will be automatically set whenever custom_stage_id is updated

-- Add the column
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS stage_assigned_at TIMESTAMPTZ;

-- Create a function to automatically update stage_assigned_at when custom_stage_id changes
CREATE OR REPLACE FUNCTION update_stage_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if custom_stage_id actually changed
  IF (NEW.custom_stage_id IS DISTINCT FROM OLD.custom_stage_id) THEN
    -- If stage is being set (not null), update the timestamp
    IF NEW.custom_stage_id IS NOT NULL THEN
      NEW.stage_assigned_at = NOW();
    ELSE
      -- If stage is being cleared, clear the timestamp
      NEW.stage_assigned_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update stage_assigned_at
DROP TRIGGER IF EXISTS trigger_update_stage_assigned_at ON conversations;
CREATE TRIGGER trigger_update_stage_assigned_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_stage_assigned_at();

-- For existing conversations with a stage, set stage_assigned_at to current time
-- (This is a one-time backfill for existing data)
UPDATE conversations 
SET stage_assigned_at = NOW() 
WHERE custom_stage_id IS NOT NULL 
  AND stage_assigned_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN conversations.stage_assigned_at IS 'Timestamp when the conversation was assigned to a pipeline stage. Automatically updated by trigger when custom_stage_id changes.';
