-- Seed 7 default editable pipeline stages
-- These stages will always show as default but users can edit them as per their business needs

INSERT INTO public.pipeline_stages (name, description, display_order) VALUES
  ('Lead', 'Fresh incoming leads', 1),
  ('Contacted', 'Initial contact made with the lead', 2),
  ('Qualified', 'Lead meets qualification criteria', 3),
  ('Proposal Sent', 'Proposal or quote sent to the lead', 4),
  ('Negotiation', 'In negotiation phase', 5),
  ('Won', 'Successfully closed deals', 6),
  ('Lost', 'Opportunity lost or not interested', 7)
ON CONFLICT DO NOTHING;

-- If stages already exist, update them to ensure we have exactly 7 default stages
-- This handles the case where some stages might already exist
DO $$
DECLARE
  stage_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stage_count FROM public.pipeline_stages;
  
  -- If no stages exist, the INSERT above will create them
  -- If stages exist but less than 7, we'll add the missing ones
  IF stage_count < 7 THEN
    -- Insert only the missing stages based on display_order
    INSERT INTO public.pipeline_stages (name, description, display_order)
    SELECT * FROM (VALUES
      ('Lead', 'Fresh incoming leads', 1),
      ('Contacted', 'Initial contact made with the lead', 2),
      ('Qualified', 'Lead meets qualification criteria', 3),
      ('Proposal Sent', 'Proposal or quote sent to the lead', 4),
      ('Negotiation', 'In negotiation phase', 5),
      ('Won', 'Successfully closed deals', 6),
      ('Lost', 'Opportunity lost or not interested', 7)
    ) AS v(name, description, display_order)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pipeline_stages 
      WHERE display_order = v.display_order
    );
  END IF;
END $$;

-- Ensure display_order is set correctly for all stages
UPDATE public.pipeline_stages 
SET display_order = subquery.new_order
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY display_order, created_at) as new_order
  FROM public.pipeline_stages
) AS subquery
WHERE public.pipeline_stages.id = subquery.id;



