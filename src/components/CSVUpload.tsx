import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, File } from "lucide-react";

const CSVUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
    } else {
      toast.error("Please select a valid CSV file");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to upload files");
      }

      // Create file path with user ID folder
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("csv-files")
        .upload(fileName, file);

      if (error) {
        throw error;
      }

      toast.success("CSV file uploaded successfully!");
      setFile(null);
      // Reset the input
      const input = document.getElementById("csv-input") as HTMLInputElement;
      if (input) input.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto">
      <div className="space-y-4">
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mt-2">Upload CSV File</h2>
          <p className="text-muted-foreground">Select a CSV file to upload to your database</p>
        </div>
        
        <div className="space-y-3">
          <Input
            id="csv-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
          
          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <File className="h-4 w-4" />
              <span>{file.name}</span>
            </div>
          )}
          
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? "Uploading..." : "Upload CSV"}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default CSVUpload;