-- Update storage policies for authenticated users
CREATE POLICY "Authenticated users can view their own files" 
ON storage.objects 
FOR SELECT 
USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'csv-files');

CREATE POLICY "Authenticated users can upload their own files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'csv-files');

CREATE POLICY "Authenticated users can update their own files" 
ON storage.objects 
FOR UPDATE 
USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'csv-files');

CREATE POLICY "Authenticated users can delete their own files" 
ON storage.objects 
FOR DELETE 
USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'csv-files');