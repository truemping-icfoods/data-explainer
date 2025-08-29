import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, File, Loader2, Send } from "lucide-react";

interface UploadedFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: {
    size?: number;
  };
}

const AnalyzeData = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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
    if (user) {
      fetchUploadedFiles();
    }
  }, [user]);

  const handleAnalyze = () => {
    if (!selectedFile) {
      toast.error("Please select a data file first");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    
    // TODO: Implement LLM analysis
    toast.success("Analysis started!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Upload
          </Button>
          <div>
            <h1 className="text-4xl font-bold">Analyze Data</h1>
            <p className="text-xl text-muted-foreground">Select a data file and enter your analysis prompt</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* File Selection */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Select Data File</h2>
            {loadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading files...</span>
              </div>
            ) : uploadedFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <File className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>No data files found</p>
                <p className="text-sm">Upload your first CSV file to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedFile === file.name
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedFile(file.name)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={selectedFile === file.name}
                        onChange={() => setSelectedFile(file.name)}
                        className="text-primary"
                      />
                      <File className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* LLM Prompt */}
          <Card className="p-6">
            <div className="space-y-4">
              <Label htmlFor="llm-prompt" className="text-xl font-semibold">
                LLM Prompt
              </Label>
              <Textarea
                id="llm-prompt"
                placeholder="Enter your analysis prompt here... e.g., 'Analyze the trends in crop yield data and provide insights'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px]"
              />
              <Button
                onClick={handleAnalyze}
                disabled={!selectedFile || !prompt.trim()}
                className="w-full"
              >
                <Send className="mr-2 h-4 w-4" />
                Analyze Data
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AnalyzeData;