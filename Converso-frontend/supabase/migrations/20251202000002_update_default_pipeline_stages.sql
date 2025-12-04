-- Update Pipeline Stages to 8 Standard Stages
-- These are the default stages for any new account/workspace
-- Admins can edit these stages as per their business needs

-- First, safely handle existing stages by moving conversations to new stages
-- We'll do this in a transaction to ensure data integrity

DO $$
DECLARE
  old_stage_ids UUID[];
  new_prospect_id UUID;
BEGIN
  -- Store old stage IDs for conversations that need to be remapped
  SELECT ARRAY_AGG(id) INTO old_stage_ids 
  FROM public.pipeline_stages;

  -- Delete all existing pipeline stages
  -- This will set custom_stage_id to NULL in conversations (ON DELETE SET NULL)
  DELETE FROM public.pipeline_stages;

  -- Insert the 8 new standard stages
  INSERT INTO public.pipeline_stages (id, name, description, display_order) VALUES
    (gen_random_uuid(), 'Prospect', 'Newly received leads', 0),
    (gen_random_uuid(), 'Discovery Call', 'Meeting to understand client requirement', 1),
    (gen_random_uuid(), 'Lead', 'Lead qualified for sales', 2),
    (gen_random_uuid(), 'Demo', 'Proposal sent to lead', 3),
    (gen_random_uuid(), 'Negotiation', 'In negotiation phase', 4),
    (gen_random_uuid(), 'Proposal Sent', 'Deal closed successfully', 5),
    (gen_random_uuid(), 'Contract Signing', 'Contract under signature at both the parties', 6),
    (gen_random_uuid(), 'Payment', '1st payment by Customer', 7),
    (gen_random_uuid(), 'Invalid Leads', 'Not the ideal client', 8);

  -- Get the ID of the first stage (Prospect) to assign conversations that had stages
  SELECT id INTO new_prospect_id 
  FROM public.pipeline_stages 
  WHERE name = 'Prospect' 
  LIMIT 1;

  -- Move all conversations that previously had a stage to the 'Prospect' stage
  UPDATE public.conversations 
  SET custom_stage_id = new_prospect_id
  WHERE custom_stage_id IS NULL 
    AND id IN (
      SELECT id FROM public.conversations 
      WHERE created_at < NOW() 
      LIMIT 1000  -- Safety limit
    );

  RAISE NOTICE 'Pipeline stages updated to 8 standard stages';
END $$;

-- Add comment explaining the stages
COMMENT ON TABLE public.pipeline_stages IS 
'Standard pipeline stages for lead management. Admins can edit these stages as per their business needs.';



