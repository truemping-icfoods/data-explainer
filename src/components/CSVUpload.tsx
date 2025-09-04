import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, File, Download, Loader2, BarChart3, Trash2 } from "lucide-react";

type FileType = "farm-data" | "certification-requirements";

interface UploadedFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: {
    size?: number;
  };
  type?: FileType;
}

const CSVUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType>("farm-data");
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    } else {
      toast.error("Please select a valid file");
    }
  };

  const fetchUploadedFiles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch from both farm-data and certification-requirements folders
      const [farmDataResponse, certResponse] = await Promise.all([
        supabase.storage.from("csv-files").list(`${user.id}/farm-data`, {
          limit: 100,
          offset: 0,
          sortBy: { column: "created_at", order: "desc" }
        }),
        supabase.storage.from("csv-files").list(`${user.id}/certification-requirements`, {
          limit: 100,
          offset: 0,
          sortBy: { column: "created_at", order: "desc" }
        })
      ]);

      const allFiles: UploadedFile[] = [];
      
      if (farmDataResponse.data) {
        allFiles.push(...farmDataResponse.data.map(file => ({ ...file, type: "farm-data" as FileType })));
      }
      
      if (certResponse.data) {
        allFiles.push(...certResponse.data.map(file => ({ ...file, type: "certification-requirements" as FileType })));
      }

      // Sort by created_at descending
      allFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setUploadedFiles(allFiles);
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

      // Create file path with user ID and file type folder
      const fileName = `${user.id}/${fileType}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("csv-files")
        .upload(fileName, file);

      if (error) {
        throw error;
      }

      toast.success("File uploaded successfully!");
      setFile(null);
      // Reset the input
      const input = document.getElementById("file-input") as HTMLInputElement;
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

  const handleDelete = async (uploadedFile: UploadedFile) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to delete files");
        return;
      }

      // Construct the file path
      const filePath = `${user.id}/${uploadedFile.type}/${uploadedFile.name}`;
      
      const { error } = await supabase.storage
        .from("csv-files")
        .remove([filePath]);

      if (error) {
        throw error;
      }

      toast.success("File deleted successfully!");
      // Refresh the file list
      fetchUploadedFiles();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Upload Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mt-2">Upload Data File</h2>
            <p className="text-muted-foreground">Select a file to upload to your database (CSV, Excel, JSON, PDF, TXT, XML)</p>
          </div>
          
          <div className="space-y-3">
            <Input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls,.json,.pdf,.txt,.xml"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            
            {file && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <File className="h-4 w-4" />
                  <span>{file.name}</span>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">File Type</Label>
                  <RadioGroup
                    value={fileType}
                    onValueChange={(value) => setFileType(value as FileType)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="farm-data" id="farm-data" />
                      <Label htmlFor="farm-data" className="text-sm cursor-pointer">
                        Farm Data
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="certification-requirements" id="certification-requirements" />
                      <Label htmlFor="certification-requirements" className="text-sm cursor-pointer">
                        Certification Requirements
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
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
                "Upload File"
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
              <p className="text-sm">Upload your first file to get started</p>
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
                        {uploadedFile.type === "farm-data" ? "Farm Data" : "Certification Requirements"} • 
                        {new Date(uploadedFile.created_at).toLocaleDateString()} • {formatFileSize(uploadedFile.metadata?.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDelete(uploadedFile)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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