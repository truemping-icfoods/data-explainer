import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, File, Download, Loader2, BarChart3 } from "lucide-react";

interface UploadedFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: {
    size?: number;
  };
}

const CSVUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
    } else {
      toast.error("Please select a valid CSV file");
    }
  };

  const fetchUploadedFiles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.storage
        .from("csv-files")
        .list(user.id, {
          limit: 100,
          offset: 0,
          sortBy: { column: "created_at", order: "desc" }
        });

      if (error) {
        console.error("Error fetching files:", error);
        return;
      }

      setUploadedFiles(data || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

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
      // Refresh the file list
      fetchUploadedFiles();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Upload Section */}
      <Card className="p-6">
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
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload CSV"
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Uploaded Files Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your Uploaded Files</h3>
            <Button 
              variant="outline" 
              onClick={() => navigate("/analyze")}
              disabled={uploadedFiles.length === 0}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analyze Data
            </Button>
          </div>
          
          {loadingFiles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading files...</span>
            </div>
          ) : uploadedFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <File className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>No files uploaded yet</p>
              <p className="text-sm">Upload your first CSV file to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {uploadedFiles.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(uploadedFile.created_at).toLocaleDateString()} • {formatFileSize(uploadedFile.metadata?.size)}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CSVUpload;