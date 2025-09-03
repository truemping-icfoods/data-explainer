import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, File, Loader2, Send, Edit, Clock, Hash } from "lucide-react";

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

const AnalyzeData = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [farmDataFiles, setFarmDataFiles] = useState<UploadedFile[]>([]);
  const [certificationFiles, setCertificationFiles] = useState<UploadedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(1000);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [llmOutput, setLlmOutput] = useState<string>("");
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'submitted' | 'in-progress' | 'successful' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [apiStatistics, setApiStatistics] = useState<{
    processingTime: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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

      const farmFiles = (farmDataResponse.data || []).map(file => ({ ...file, type: "farm-data" as FileType }));
      const certFiles = (certResponse.data || []).map(file => ({ ...file, type: "certification-requirements" as FileType }));

      setFarmDataFiles(farmFiles);
      setCertificationFiles(certFiles);
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

  const handleEdit = () => {
    setPrompt("");
    setLlmOutput("");
    setAnalysisStatus('idle');
    setErrorMessage("");
    setApiStatistics(null);
  };

  const handleFileSelection = (fileName: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedFiles(prev => [...prev, fileName]);
    } else {
      setSelectedFiles(prev => prev.filter(f => f !== fileName));
    }
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one data file first");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    
    setAnalysisStatus('submitted');
    setErrorMessage("");
    setLlmOutput("");
    setApiStatistics(null);
    toast.success("Analysis submitted!");
    
    setTimeout(() => {
      setAnalysisStatus('in-progress');
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-data', {
        body: {
          selectedFiles,
          prompt,
          temperature,
          maxTokens
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to analyze data');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysisStatus('successful');
      setLlmOutput(data.generatedText);
      setApiStatistics(data.statistics);
      toast.success("Analysis completed successfully!");

    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisStatus('error');
      setErrorMessage(error.message || 'An unexpected error occurred during analysis');
      toast.error("Analysis failed");
    }
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
          {loadingFiles ? (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Select Data Files</h2>
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading files...</span>
              </div>
            </Card>
          ) : farmDataFiles.length === 0 && certificationFiles.length === 0 ? (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Select Data Files</h2>
              <div className="text-center py-8 text-muted-foreground">
                <File className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>No data files found</p>
                <p className="text-sm">Upload your first CSV file to get started</p>
              </div>
            </Card>
          ) : (
            <>
              {/* Farm Data Files */}
              {farmDataFiles.length > 0 && (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Farm Data Files</h2>
                  <div className="space-y-2">
                    {farmDataFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedFiles.includes(file.name)
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => handleFileSelection(file.name, !selectedFiles.includes(file.name))}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedFiles.includes(file.name)}
                            onCheckedChange={(checked) => handleFileSelection(file.name, checked as boolean)}
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
                </Card>
              )}

              {/* Certification Requirements Files */}
              {certificationFiles.length > 0 && (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Certification Requirements Files</h2>
                  <div className="space-y-2">
                    {certificationFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedFiles.includes(file.name)
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => handleFileSelection(file.name, !selectedFiles.includes(file.name))}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedFiles.includes(file.name)}
                            onCheckedChange={(checked) => handleFileSelection(file.name, checked as boolean)}
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
                </Card>
              )}
            </>
          )}

          {/* LLM Prompt and Settings */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="llm-prompt" className="text-xl font-semibold">
                  LLM Prompt & Settings
                </Label>
                {prompt.trim() && analysisStatus !== 'in-progress' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEdit}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
              
              <Textarea
                id="llm-prompt"
                placeholder="Enter your analysis prompt here... e.g., 'Analyze the trends in crop yield data and provide insights'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px]"
              />
              
              {/* OpenAI Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature (0.0 - 2.0)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                    placeholder="0.7"
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness. Lower = more focused, Higher = more creative
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min="1"
                    max="4000"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
                    placeholder="1000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum length of the response (1-4000 tokens)
                  </p>
                </div>
              </div>
              
              <Button
                onClick={handleAnalyze}
                disabled={selectedFiles.length === 0 || !prompt.trim() || analysisStatus === 'in-progress'}
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

          {/* API Statistics */}
          {apiStatistics && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">API Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Processing Time</p>
                    <p className="font-semibold">{apiStatistics.processingTime}s</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Hash className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Input Tokens</p>
                    <p className="font-semibold">{apiStatistics.inputTokens.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Hash className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Output Tokens</p>
                    <p className="font-semibold">{apiStatistics.outputTokens.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Hash className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Tokens</p>
                    <p className="font-semibold">{apiStatistics.totalTokens.toLocaleString()}</p>
                  </div>
                </div>
              </div>
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