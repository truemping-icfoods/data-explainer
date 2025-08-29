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
  const [llmOutput, setLlmOutput] = useState<string>("");
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'submitted' | 'in-progress' | 'successful' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>("");

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

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error("Please select a data file first");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    
    // Simulate LLM analysis workflow
    setAnalysisStatus('submitted');
    setErrorMessage("");
    setLlmOutput("");
    toast.success("Analysis submitted!");
    
    // Simulate processing time
    setTimeout(() => {
      setAnalysisStatus('in-progress');
    }, 500);
    
    // Simulate API call with random success/error
    setTimeout(() => {
      const isSuccess = Math.random() > 0.2; // 80% success rate
      
      if (isSuccess) {
        setAnalysisStatus('successful');
        // Simulate LLM response (256 tokens)
        const mockResponse = `Based on the analysis of ${selectedFile}, here are the key insights from your prompt "${prompt.substring(0, 50)}...": 

The data reveals several interesting patterns and trends. The analysis shows significant correlations between various data points, with notable seasonal variations and growth patterns emerging from the dataset. Key metrics indicate strong performance in certain categories while highlighting areas that may require attention.

The statistical analysis reveals important trends that could inform strategic decision-making. Data quality appears robust with minimal outliers, and the temporal patterns suggest consistent underlying processes. These findings provide a solid foundation for further investigation and tactical implementation.

[Simulated response - 256 tokens limit reached]`;
        setLlmOutput(mockResponse);
        toast.success("Analysis completed successfully!");
      } else {
        setAnalysisStatus('error');
        setErrorMessage("Simulation error: OpenAI API key not configured. Please add your API key to enable real LLM analysis.");
        toast.error("Analysis failed - API key needed");
      }
    }, 3000);
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
                disabled={!selectedFile || !prompt.trim() || analysisStatus === 'in-progress'}
                className="w-full"
              >
                {analysisStatus === 'in-progress' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {analysisStatus === 'in-progress' ? 'Analyzing...' : 'Analyze Data'}
              </Button>
            </div>
          </Card>

          {/* Analysis Status */}
          {analysisStatus !== 'idle' && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Analysis Status</h2>
              <div className="flex items-center gap-3">
                {analysisStatus === 'in-progress' && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <span className={`font-medium ${
                  analysisStatus === 'successful' ? 'text-green-600' :
                  analysisStatus === 'error' ? 'text-red-600' :
                  analysisStatus === 'in-progress' ? 'text-blue-600' :
                  'text-gray-600'
                }`}>
                  {analysisStatus === 'submitted' && 'Submitted'}
                  {analysisStatus === 'in-progress' && 'In Progress'}
                  {analysisStatus === 'successful' && 'Successful'}
                  {analysisStatus === 'error' && 'Error'}
                </span>
              </div>
              {errorMessage && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}
            </Card>
          )}

          {/* LLM Output */}
          {llmOutput && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Analysis Results</h2>
              <div className="bg-muted/50 p-4 rounded-lg border">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
                  {llmOutput}
                </pre>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyzeData;