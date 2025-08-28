-- Create storage bucket for CSV files
INSERT INTO storage.buckets (id, name, public) VALUES ('csv-files', 'csv-files', false);

-- Create RLS policies for CSV file uploads
CREATE POLICY "Allow authenticated users to upload CSV files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'csv-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow users to view their own CSV files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'csv-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow users to delete their own CSV files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'csv-files' AND auth.uid() IS NOT NULL);