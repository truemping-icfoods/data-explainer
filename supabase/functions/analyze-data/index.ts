import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { selectedFiles, prompt, temperature, maxTokens } = await req.json();

    console.log('Received request:', { selectedFiles, prompt, temperature, maxTokens });

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

    // Prepare OpenAI API request for GPT-5 (no temperature, uses max_completion_tokens)
    const openAIRequestBody: any = {
      model: 'gpt-5-2025-08-07',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful data analyst. Analyze the provided data files according to the user\'s prompt and provide detailed insights, patterns, and recommendations. Always provide a clear, concise response in your output.' 
        },
        { role: 'user', content: fullPrompt }
      ],
      // Ensure we have enough tokens for both reasoning and output
      max_completion_tokens: Math.max(maxTokens || 2000, 1000),
    };

    // Note: GPT-5 does not support the temperature parameter; it will be ignored if provided

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
    const reasoningTokens = usage.reasoning_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

    // Check if we got empty content despite using tokens
    if (!generatedText && reasoningTokens > 0) {
      console.log('Warning: GPT-5 used reasoning tokens but returned empty content');
      generatedText = 'The analysis used reasoning tokens but did not produce visible output. This can happen with GPT-5 when all tokens are used for internal reasoning. Try increasing max tokens or simplifying your prompt.';
    }

    const result = {
      generatedText: typeof generatedText === 'string' ? generatedText.trim() : '',
      statistics: {
        processingTime: parseFloat(processingTime.toFixed(2)),
        inputTokens,
        outputTokens,
        reasoningTokens,
        totalTokens,
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