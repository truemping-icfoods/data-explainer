import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to detect downloadable content in LLM response
function detectDownloadableContent(text: string) {
  if (!text) return null;

  // Patterns to detect different file types
  const patterns = [
    {
      type: 'csv',
      pattern: /```csv\n([\s\S]*?)\n```/i,
      extension: 'csv',
      mimeType: 'text/csv'
    },
    {
      type: 'json',
      pattern: /```json\n([\s\S]*?)\n```/i,
      extension: 'json',
      mimeType: 'application/json'
    },
    {
      type: 'xml',
      pattern: /```xml\n([\s\S]*?)\n```/i,
      extension: 'xml',
      mimeType: 'application/xml'
    },
    {
      type: 'txt',
      pattern: /```(?:txt|text)\n([\s\S]*?)\n```/i,
      extension: 'txt',
      mimeType: 'text/plain'
    },
    {
      type: 'sql',
      pattern: /```sql\n([\s\S]*?)\n```/i,
      extension: 'sql',
      mimeType: 'text/plain'
    },
    {
      type: 'python',
      pattern: /```python\n([\s\S]*?)\n```/i,
      extension: 'py',
      mimeType: 'text/plain'
    },
    {
      type: 'javascript',
      pattern: /```(?:javascript|js)\n([\s\S]*?)\n```/i,
      extension: 'js',
      mimeType: 'text/plain'
    }
  ];

  // Check for CSV-like content (comma-separated values with headers)
  const csvLikePattern = /^[^,\n]+(?:,[^,\n]+)*\n(?:[^,\n]*(?:,[^,\n]*)*\n?)+$/m;
  if (csvLikePattern.test(text.trim()) && text.includes(',')) {
    const lines = text.trim().split('\n');
    if (lines.length > 1 && lines[0].includes(',')) {
      return {
        hasFile: true,
        content: text.trim(),
        filename: 'analysis_result.csv',
        extension: 'csv',
        mimeType: 'text/csv',
        type: 'csv'
      };
    }
  }

  // Check for code block patterns
  for (const pattern of patterns) {
    const match = text.match(pattern.pattern);
    if (match && match[1]) {
      return {
        hasFile: true,
        content: match[1].trim(),
        filename: `analysis_result.${pattern.extension}`,
        extension: pattern.extension,
        mimeType: pattern.mimeType,
        type: pattern.type
      };
    }
  }

  // Check for JSON-like content
  try {
    const trimmed = text.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      JSON.parse(trimmed);
      return {
        hasFile: true,
        content: trimmed,
        filename: 'analysis_result.json',
        extension: 'json',
        mimeType: 'application/json',
        type: 'json'
      };
    }
  } catch (e) {
    // Not valid JSON, continue
  }

  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { selectedFiles, prompt, temperature, maxTokens, model } = await req.json();

    console.log('Received request:', { selectedFiles, prompt, temperature, maxTokens, model });

    // Get OpenAI API key from environment
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured. Please add your OPENAI_API_KEY to Supabase Edge Functions secrets.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Read file contents
    let fileContents = '';
    for (const fileName of selectedFiles) {
      try {
        // Try both possible locations for the file
        let { data, error } = await supabase.storage
          .from('csv-files')
          .download(`${user.id}/farm-data/${fileName}`);
        
        if (error) {
          // Try certification-requirements folder
          const result = await supabase.storage
            .from('csv-files')
            .download(`${user.id}/certification-requirements/${fileName}`);
          data = result.data;
          if (result.error) {
            console.error(`Error downloading file ${fileName}:`, result.error);
            continue;
          }
        }

        if (data) {
          const text = await data.text();
          fileContents += `\n\n=== File: ${fileName} ===\n${text}`;
          console.log(`Successfully read file: ${fileName}, size: ${text.length} chars`);
        }
      } catch (error) {
        console.error(`Error reading file ${fileName}:`, error);
      }
    }

    if (!fileContents) {
      return new Response(JSON.stringify({ 
        error: 'No file contents could be read from the selected files' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare the full prompt with file contents
    const fullPrompt = `${prompt}

Here are the contents of the selected data files:
${fileContents}

Please analyze this data according to the prompt above.`;

    console.log('Full prompt length:', fullPrompt.length);

    // Record start time for processing time calculation
    const startTime = Date.now();

    // Prepare OpenAI API request - different models need different parameters
    const openAIRequestBody: any = {
      model: model || 'gpt-5-2025-08-07',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful data analyst. Analyze the provided data files according to the user\'s prompt and provide detailed insights, patterns, and recommendations. Always provide a clear, concise response in your output.' 
        },
        { role: 'user', content: fullPrompt }
      ]
    };

    // Handle model-specific parameters
    const isGPT5OrNewer = (model || '').includes('gpt-5') || (model || '').includes('o3') || (model || '').includes('o4') || (model || '').includes('gpt-4.1');
    
    if (isGPT5OrNewer) {
      // GPT-5 and newer models use max_completion_tokens and don't support temperature
      openAIRequestBody.max_completion_tokens = Math.max(maxTokens || 2000, 1000);
    } else {
      // Legacy models (gpt-4o, gpt-4o-mini) use max_tokens and support temperature
      openAIRequestBody.max_tokens = maxTokens || 2000;
      openAIRequestBody.temperature = temperature || 0.7;
    }

    console.log('Calling OpenAI API with model:', openAIRequestBody.model);

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openAIRequestBody),
    });

    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000; // Convert to seconds

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      return new Response(JSON.stringify({ 
        error: `OpenAI API error: ${response.status} - ${errorData}` 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('OpenAI API response received');
    console.log('Full OpenAI response:', JSON.stringify(data, null, 2));

    // Extract the generated text robustly (handles string and array content shapes)
    let generatedText = '';
    try {
      const choice0 = data?.choices?.[0] ?? {};
      const message = choice0?.message ?? {};
      const msgContent = message?.content;

      if (typeof msgContent === 'string') {
        generatedText = msgContent;
      } else if (Array.isArray(msgContent)) {
        generatedText = msgContent
          .map((part: any) =>
            typeof part === 'string' ? part : (part?.text ?? part?.content ?? '')
          )
          .join('');
      }

      // Additional fallbacks some models may use
      const choiceContent = choice0?.content;
      if (!generatedText && typeof choiceContent === 'string') {
        generatedText = choiceContent;
      } else if (!generatedText && Array.isArray(choiceContent)) {
        generatedText = choiceContent
          .map((part: any) =>
            typeof part === 'string' ? part : (part?.text ?? part?.content ?? '')
          )
          .join('');
      }

      if (!generatedText && typeof data?.output_text === 'string') {
        generatedText = data.output_text;
      }
    } catch (e) {
      console.error('Error extracting generated text:', e);
    }

    const usage = data.usage || {};
    
    console.log('Extracted generated text length:', (generatedText || '').length);
    console.log('Generated text preview:', (generatedText || '').substring(0, 200));

    const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
    
    // Extract reasoning tokens from completion_tokens_details for GPT-5 models
    const reasoningTokens = usage.reasoning_tokens ?? 
                           usage.completion_tokens_details?.reasoning_tokens ?? 0;
    
    const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

    // Check if we got empty content despite using tokens (common with GPT-5 models)
    if (!generatedText && (reasoningTokens > 0 || outputTokens > 0)) {
      console.log('Warning: Model used tokens but returned empty content. Reasoning tokens:', reasoningTokens, 'Output tokens:', outputTokens);
      
      // For GPT-5 models that use reasoning tokens, provide more helpful message
      if (reasoningTokens > 0) {
        generatedText = `The model completed internal reasoning using ${reasoningTokens} tokens but produced no visible output. This suggests the max_completion_tokens (${maxTokens || 2000}) may be too low for this complex analysis. Try increasing to 4000+ tokens or simplifying your prompt.`;
      } else {
        generatedText = 'The model processed your request but returned empty content. Try rephrasing your prompt or increasing the max tokens setting.';
      }
    }

    // Detect if the response contains downloadable file content
    const fileInfo = detectDownloadableContent(generatedText);

    const result = {
      generatedText: typeof generatedText === 'string' ? generatedText.trim() : '',
      fileInfo,
      statistics: {
        processingTime: parseFloat(processingTime.toFixed(2)),
        inputTokens,
        outputTokens,
        reasoningTokens,
        totalTokens,
        model: openAIRequestBody.model,
      }
    };

    console.log('Analysis completed:', result.statistics);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-data function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});