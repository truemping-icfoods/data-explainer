-- Add RLS policies for FarmerData table
CREATE POLICY "Allow public read access to FarmerData" 
ON public."FarmerData" 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to FarmerData" 
ON public."FarmerData" 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to FarmerData" 
ON public."FarmerData" 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to FarmerData" 
ON public."FarmerData" 
FOR DELETE 
USING (true);