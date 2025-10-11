import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  try {
    console.log('[update-puck-site] Received POST request');
    const { prompt, currentData, currentConfig } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      console.error('[update-puck-site] Invalid prompt:', prompt);
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 });
    }

    if (!currentData || !currentConfig) {
      console.error('[update-puck-site] Missing current data or config');
      return NextResponse.json({ success: false, error: 'currentData and currentConfig are required' }, { status: 400 });
    }

    console.log('[update-puck-site] ════════════════════════════════════════');
    console.log('[update-puck-site] Updating site with AI for prompt:', prompt);
    console.log('[update-puck-site] Current components:', Object.keys(currentConfig.components || {}).join(', '));
    console.log('[update-puck-site] Current content items:', currentData.content?.length || 0);
    console.log('[update-puck-site] ════════════════════════════════════════');

    // Use AI to generate the updated site structure
    const generated = await updateSiteWithAI(prompt, currentData, currentConfig);

    console.log('[update-puck-site] AI update complete, serializing config...');

    // Convert config to JavaScript string
    const configJs = serializeConfig(generated.config);

    console.log('[update-puck-site] Config serialized, length:', configJs.length);

    console.log('[update-puck-site] ════════════════════════════════════════');
    console.log('[update-puck-site] ✓ Successfully updated site');
    console.log('[update-puck-site]   - Components:', Object.keys(generated.config.components).length);
    console.log('[update-puck-site]   - Content items:', generated.data.content.length);
    console.log('[update-puck-site]   - Config JS length:', configJs.length);
    console.log('[update-puck-site] ════════════════════════════════════════');

    return NextResponse.json({
      success: true,
      puck: {
        data: generated.data,
        configJs
      }
    });
  } catch (err: any) {
    console.error('[update-puck-site] ════════════════════════════════════════');
    console.error('[update-puck-site] ✗ Error updating site:', err);
    console.error('[update-puck-site] Error message:', err?.message);
    console.error('[update-puck-site] Error stack:', err?.stack);
    console.error('[update-puck-site] ════════════════════════════════════════');

    return NextResponse.json({
      success: false,
      error: err?.message || 'failed'
    }, { status: 500 });
  }
}

const UPDATE_SYSTEM_PROMPT = `You are an expert at updating structured Puck editor configurations for websites.

Puck is a visual page builder for React. You will receive:
1. The current Puck data structure (content array with components)
2. The current Puck config (component definitions with fields and render functions)
3. A user request to modify the site

Your task is to generate the UPDATED data and config based on the user's request.

IMPORTANT RULES:
1. PRESERVE existing components and content unless explicitly asked to change them
2. When adding new components, add them to BOTH data.content AND config.components
3. When updating components, modify ONLY what was requested
4. Render functions must be STRING representations
5. Maintain the same structure and IDs for unchanged components
6. Use the same component types and naming conventions as the existing site

PUCK DATA STRUCTURE:
{
  "content": [
    {
      "type": "ComponentName",
      "props": {
        "id": "unique-id"
        // component-specific props
      }
    }
  ],
  "root": {
    "props": {
      "title": "Site Title",
      "theme": "light"
    }
  },
  "zones": {}
}

PUCK CONFIG STRUCTURE:
{
  "components": {
    "ComponentName": {
      "label": "Display Name",
      "fields": {
        "fieldName": { "type": "text", "label": "Field Label" }
      },
      "render": "({ fieldName }) => React.createElement('div', {style: {padding: 20}}, fieldName)"
    }
  }
}

RENDER FUNCTION FORMAT (as strings):
- Use React.createElement() instead of JSX
- Keep on single lines
- Use inline styles
- Escape quotes properly
- Example: "({ title }) => React.createElement('h1', {style: {fontSize: 48}}, title)"

MODIFICATION GUIDELINES:
1. "Add a [component]" → Add new component to data.content AND config.components
2. "Change [component] [property]" → Update specific property in data.content
3. "Remove [component]" → Remove from data.content (keep in config for reusability)
4. "Update styling" → Modify render function styles in config
5. "Reorder components" → Change order in data.content array

CRITICAL JSON RULES:
1. ALL strings use DOUBLE QUOTES (")
2. Render functions are strings - single line, no breaks
3. Escape special characters
4. No trailing commas
5. Use null instead of undefined
6. Validate JSON is parseable

RESPOND WITH ONLY VALID JSON - no markdown, no explanations, just the raw JSON object with updated data and config.`;

// JSON Schema for structured output
const UPDATE_PUCK_SCHEMA = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: {
        content: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              props: { type: "object" }
            },
            required: ["type", "props"]
          }
        },
        root: {
          type: "object",
          properties: {
            props: {
              type: "object",
              properties: {
                title: { type: "string" },
                theme: { type: "string" }
              }
            }
          }
        },
        zones: { type: "object" }
      },
      required: ["content", "root", "zones"]
    },
    config: {
      type: "object",
      properties: {
        components: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              label: { type: "string" },
              fields: { type: "object" },
              render: { type: "string" }
            },
            required: ["label", "fields", "render"]
          }
        }
      },
      required: ["components"]
    }
  },
  required: ["data", "config"]
};

async function updateSiteWithAI(prompt: string, currentData: any, currentConfig: any): Promise<{ data: any; config: any }> {
  console.log('[AI Updater] Starting site update...');
  console.log('[AI Updater] User prompt:', prompt);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('[AI Updater] ANTHROPIC_API_KEY is not set!');
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  console.log('[AI Updater] API key found, initializing Anthropic client...');
  const anthropic = new Anthropic({ apiKey });

  // Serialize current config for the prompt
  const currentConfigStr = JSON.stringify(currentConfig, null, 2);
  const currentDataStr = JSON.stringify(currentData, null, 2);

  console.log('[AI Updater] Current data length:', currentDataStr.length);
  console.log('[AI Updater] Current config length:', currentConfigStr.length);
  console.log('[AI Updater] Sending request to Claude with structured output...');

  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    temperature: 0.7,
    system: [
      {
        type: "text",
        text: UPDATE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }
      },
      {
        type: "text",
        text: `You MUST respond with ONLY a valid JSON object matching this exact schema:\n\n${JSON.stringify(UPDATE_PUCK_SCHEMA, null, 2)}\n\nDo not include any markdown, explanations, or text outside the JSON object.`,
        cache_control: { type: "ephemeral" }
      }
    ],
    messages: [
      {
        role: 'user',
        content: `CURRENT SITE DATA:\n${currentDataStr}\n\nCURRENT SITE CONFIG:\n${currentConfigStr}\n\nUSER REQUEST:\n${prompt}\n\nGenerate the UPDATED data and config. Respond with ONLY the JSON object, nothing else.`
      }
    ]
  });

  const elapsed = Date.now() - startTime;
  console.log(`[AI Updater] Received response from Claude in ${elapsed}ms`);
  console.log('[AI Updater] Response stop reason:', response.stop_reason);
  console.log('[AI Updater] Input tokens:', response.usage.input_tokens);
  console.log('[AI Updater] Output tokens:', response.usage.output_tokens);

  const content = response.content[0];
  if (content.type !== 'text') {
    console.error('[AI Updater] Unexpected response type:', content.type);
    throw new Error('Unexpected response type from Claude');
  }

  console.log('[AI Updater] Response text length:', content.text.length);

  let generated: { data: any; config: any };

  try {
    console.log('[AI Updater] Parsing structured JSON output...');
    generated = JSON.parse(content.text);
    console.log('[AI Updater] ✓ Successfully parsed structured output');
  } catch (parseError: any) {
    console.error('[AI Updater] Failed to parse structured output:', parseError.message);
    console.error('[AI Updater] Full response:', content.text);

    // Fallback: try to extract JSON
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        generated = JSON.parse(jsonMatch[0]);
        console.log('[AI Updater] ✓ Recovered with JSON extraction fallback');
      } catch {
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }
    } else {
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }
  }

  // Validate the response structure
  if (!generated.data || !generated.config) {
    console.error('[AI Updater] Invalid response structure!');
    throw new Error('Invalid response structure from AI');
  }

  console.log('[AI Updater] ✓ Successfully parsed and validated response');
  console.log('[AI Updater] Updated data:');
  console.log('  - Content items:', generated.data.content?.length || 0);
  console.log('[AI Updater] Updated config:');
  console.log('  - Components:', Object.keys(generated.config.components || {}).length);

  return generated;
}

// Helper function to serialize config with render functions
function serializeConfig(config: any): string {
  const serialized = serializeObject(config, 0);
  return `export const config = ${serialized};`;
}

function serializeObject(obj: any, depth: number): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';

  const indent = '  '.repeat(depth);
  const nextIndent = '  '.repeat(depth + 1);

  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (typeof obj === 'function') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    const items = obj.map(item => `${nextIndent}${serializeObject(item, depth + 1)}`);
    return `[\n${items.join(',\n')}\n${indent}]`;
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj).map(([key, value]) => {
      // Special handling for 'render' key - it should be a function string
      let serializedValue;
      if (key === 'render' && typeof value === 'string') {
        // If render is a string (function code from AI), don't quote it
        serializedValue = value;
      } else {
        serializedValue = serializeObject(value, depth + 1);
      }

      // Handle special cases where keys need quotes
      const needsQuotes = /[^a-zA-Z0-9_$]/.test(key);
      const keyStr = needsQuotes ? JSON.stringify(key) : key;
      return `${nextIndent}${keyStr}: ${serializedValue}`;
    });
    return `{\n${entries.join(',\n')}\n${indent}}`;
  }

  return String(obj);
}
