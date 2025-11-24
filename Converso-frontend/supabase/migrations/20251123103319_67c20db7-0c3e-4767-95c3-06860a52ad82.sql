-- Create pipeline_stages table for custom stages
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage all stages
CREATE POLICY "Admins can manage pipeline stages"
ON public.pipeline_stages
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Allow all authenticated users to view stages
CREATE POLICY "Users can view pipeline stages"
ON public.pipeline_stages
FOR SELECT
TO authenticated
USING (true);

-- Add custom_stage field to conversations to link to custom stages
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS custom_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_custom_stage ON public.conversations(custom_stage_id);

-- Create trigger for updated_at
CREATE TRIGGER update_pipeline_stages_updated_at
BEFORE UPDATE ON public.pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();