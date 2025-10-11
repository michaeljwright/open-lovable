import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  try {
    console.log('[generate-puck-site] Received POST request');
    const { prompt, context } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      console.error('[generate-puck-site] Invalid prompt:', prompt);
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 });
    }

    console.log('[generate-puck-site] ════════════════════════════════════════');
    console.log('[generate-puck-site] Generating new site with AI for prompt:', prompt);
    console.log('[generate-puck-site] ════════════════════════════════════════');

    // Use AI to generate the site structure
    const generated = await generateSiteWithAI(prompt, context);

    console.log('[generate-puck-site] AI generation complete, serializing config...');

    // Convert config to JavaScript string
    const configJs = serializeConfig(generated.config);

    console.log('[generate-puck-site] Config serialized, length:', configJs.length);

    console.log('[generate-puck-site] ════════════════════════════════════════');
    console.log('[generate-puck-site] ✓ Successfully generated site');
    console.log('[generate-puck-site]   - Components:', Object.keys(generated.config.components).length);
    console.log('[generate-puck-site]   - Content items:', generated.data.content.length);
    console.log('[generate-puck-site]   - Config JS length:', configJs.length);
    console.log('[generate-puck-site] ════════════════════════════════════════');

    return NextResponse.json({
      success: true,
      puck: {
        data: generated.data,
        configJs
      }
    });
  } catch (err: any) {
    console.error('[generate-puck-site] ════════════════════════════════════════');
    console.error('[generate-puck-site] ✗ Error generating site:', err);
    console.error('[generate-puck-site] Error message:', err?.message);
    console.error('[generate-puck-site] Error stack:', err?.stack);
    console.error('[generate-puck-site] ════════════════════════════════════════');

    return NextResponse.json({
      success: false,
      error: err?.message || 'failed'
    }, { status: 500 });
  }
}

const GENERATE_SYSTEM_PROMPT = `You are an expert at creating structured Puck editor configurations for websites.

Puck is a visual page builder for React. Your task is to generate the INITIAL data and config based on the user's request.

IMPORTANT RULES:
1. Create a complete, visually appealing website with multiple sections
2. Each section should be a component in BOTH data.content AND config.components
3. Render functions must be STRING representations using React.createElement()
4. Use modern, clean design with proper styling
5. Make the site fully functional and ready to edit

PUCK DATA STRUCTURE:
{
  "content": [
    {
      "type": "ComponentName",
      "props": {
        "id": "unique-id",
        // component-specific props like title, description, imageUrl, etc.
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
        "fieldName": { "type": "text", "label": "Field Label" },
        "description": { "type": "textarea", "label": "Description" },
        "imageUrl": { "type": "text", "label": "Image URL" }
      },
      "render": "({ fieldName, description }) => React.createElement('div', {style: {padding: 20}}, React.createElement('h2', {}, fieldName), React.createElement('p', {}, description))"
    }
  }
}

RENDER FUNCTION FORMAT (as strings):
- Use React.createElement() instead of JSX
- Keep functions readable but on single lines (or use string concatenation for clarity)
- Use inline styles with CSS-in-JS objects
- Escape quotes properly
- Common patterns:
  * Headings: "React.createElement('h1', {style: {fontSize: '48px', fontWeight: 'bold', color: '#1a202c'}}, title)"
  * Sections: "React.createElement('section', {style: {padding: '80px 20px', backgroundColor: '#f7fafc'}}, ...)"
  * Containers: "React.createElement('div', {style: {maxWidth: '1200px', margin: '0 auto'}}, ...)"
  * Buttons: "React.createElement('button', {style: {padding: '12px 24px', backgroundColor: '#805cf5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}}, buttonText)"

COMPONENT TYPES TO INCLUDE:
1. **Hero** - Main landing section with heading, description, and CTA
2. **Features** - Grid of feature cards with icons/images, titles, and descriptions
3. **About** - About section with image and text
4. **Testimonials** - Customer testimonials or reviews
5. **Pricing** - Pricing tiers (if relevant)
6. **CTA** - Call-to-action section
7. **Footer** - Footer with links and contact info

STYLING GUIDELINES:
- Use modern color palettes (primary: #805cf5, neutral grays, etc.)
- Proper spacing: padding 60-100px for sections, 20px for cards
- Responsive considerations: maxWidth, margin auto for centering
- Clean typography: fontSize in px, fontWeight, lineHeight
- Hover effects where appropriate: cursor pointer, opacity changes

FIELD TYPES (ALL fields MUST have both "type" AND "label"):
- { "type": "text", "label": "Title" } for short text (titles, names, etc.)
- { "type": "textarea", "label": "Description" } for longer text (descriptions, content)
- { "type": "number", "label": "Count" } for numeric values
- { "type": "select", "label": "Choose", "options": [{"label": "Option 1", "value": "opt1"}] } for dropdowns
- { "type": "radio", "label": "Select", "options": [{"label": "Option 1", "value": "opt1"}] } for radio buttons

CRITICAL: Every field definition MUST include BOTH "type" and "label" properties or Puck will crash!

CRITICAL JSON RULES:
1. ALL strings use DOUBLE QUOTES (")
2. Render functions are strings - escape inner quotes
3. No trailing commas
4. Use null instead of undefined
5. Validate JSON is parseable

EXAMPLE COMPONENT:
{
  "Hero": {
    "label": "Hero Section",
    "fields": {
      "title": { "type": "text", "label": "Title" },
      "subtitle": { "type": "textarea", "label": "Subtitle" },
      "buttonText": { "type": "text", "label": "Button Text" },
      "buttonUrl": { "type": "text", "label": "Button URL" }
    },
    "render": "({ title, subtitle, buttonText }) => React.createElement('section', {style: {padding: '100px 20px', textAlign: 'center', backgroundColor: '#f7fafc'}}, React.createElement('div', {style: {maxWidth: '800px', margin: '0 auto'}}, React.createElement('h1', {style: {fontSize: '56px', fontWeight: 'bold', marginBottom: '20px', color: '#1a202c'}}, title), React.createElement('p', {style: {fontSize: '20px', color: '#4a5568', marginBottom: '30px'}}, subtitle), React.createElement('button', {style: {padding: '14px 32px', backgroundColor: '#805cf5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', fontWeight: '600'}}, buttonText)))"
  }
}

RESPOND WITH ONLY VALID JSON - no markdown, no explanations, just the raw JSON object with data and config.`;

// JSON Schema for structured output
const GENERATE_PUCK_SCHEMA = {
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
              fields: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    label: { type: "string" }
                  },
                  required: ["type", "label"]
                }
              },
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

async function generateSiteWithAI(prompt: string, context: any): Promise<{ data: any; config: any }> {
  console.log('[AI Generator] Starting site generation...');
  console.log('[AI Generator] User prompt:', prompt);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('[AI Generator] ANTHROPIC_API_KEY is not set!');
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  console.log('[AI Generator] API key found, initializing Anthropic client...');
  const anthropic = new Anthropic({ apiKey });

  // Build context from scraped content or other sources
  let contextStr = '';
  if (context) {
    if (context.conversationContext?.scrapedWebsites?.length > 0) {
      contextStr += '\n\nSCRAPED WEBSITE CONTEXT:\n';
      context.conversationContext.scrapedWebsites.forEach((site: any) => {
        contextStr += `\nURL: ${site.url}\n`;
        if (site.content) {
          const preview = typeof site.content === 'string'
            ? site.content.substring(0, 2000)
            : JSON.stringify(site.content).substring(0, 2000);
          contextStr += `Content: ${preview}...\n`;
        }
      });
    }
  }

  console.log('[AI Generator] Context length:', contextStr.length);
  console.log('[AI Generator] Sending request to Claude with structured output...');

  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    temperature: 0.7,
    system: [
      {
        type: "text",
        text: GENERATE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }
      },
      {
        type: "text",
        text: `You MUST respond with ONLY a valid JSON object matching this exact schema:\n\n${JSON.stringify(GENERATE_PUCK_SCHEMA, null, 2)}\n\nDo not include any markdown, explanations, or text outside the JSON object.`,
        cache_control: { type: "ephemeral" }
      }
    ],
    messages: [
      {
        role: 'user',
        content: `${contextStr}\n\nUSER REQUEST:\n${prompt}\n\nGenerate a complete website with data and config. Respond with ONLY the JSON object, nothing else.`
      }
    ]
  });

  const elapsed = Date.now() - startTime;
  console.log(`[AI Generator] Received response from Claude in ${elapsed}ms`);
  console.log('[AI Generator] Response stop reason:', response.stop_reason);
  console.log('[AI Generator] Input tokens:', response.usage.input_tokens);
  console.log('[AI Generator] Output tokens:', response.usage.output_tokens);

  const content = response.content[0];
  if (content.type !== 'text') {
    console.error('[AI Generator] Unexpected response type:', content.type);
    throw new Error('Unexpected response type from Claude');
  }

  console.log('[AI Generator] Response text length:', content.text.length);

  let generated: { data: any; config: any };

  try {
    console.log('[AI Generator] Parsing structured JSON output...');
    generated = JSON.parse(content.text);
    console.log('[AI Generator] ✓ Successfully parsed structured output');
  } catch (parseError: any) {
    console.error('[AI Generator] Failed to parse structured output:', parseError.message);
    console.error('[AI Generator] Full response:', content.text);

    // Fallback: try to extract JSON
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        generated = JSON.parse(jsonMatch[0]);
        console.log('[AI Generator] ✓ Recovered with JSON extraction fallback');
      } catch {
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }
    } else {
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }
  }

  // Validate the response structure
  if (!generated.data || !generated.config) {
    console.error('[AI Generator] Invalid response structure!');
    throw new Error('Invalid response structure from AI');
  }

  // Validate and fix field definitions to ensure they all have type and label
  console.log('[AI Generator] Validating field definitions...');
  for (const [componentName, componentDef] of Object.entries(generated.config.components)) {
    const component = componentDef as any;

    // Ensure component has required properties
    if (!component.label) {
      console.warn(`[AI Generator] Component ${componentName} missing label, adding default`);
      component.label = componentName;
    }
    if (!component.fields) {
      console.warn(`[AI Generator] Component ${componentName} missing fields, adding empty object`);
      component.fields = {};
    }
    if (!component.render) {
      console.warn(`[AI Generator] Component ${componentName} missing render function, adding default`);
      component.render = `() => React.createElement('div', {}, '${componentName}')`;
    }

    // Validate each field has type and label, and clean up unexpected properties
    for (const [fieldName, fieldDef] of Object.entries(component.fields)) {
      const field = fieldDef as any;

      // Ensure required properties exist
      if (!field.type) {
        console.warn(`[AI Generator] Field ${componentName}.${fieldName} missing type, defaulting to 'text'`);
        field.type = 'text';
      }
      if (!field.label) {
        console.warn(`[AI Generator] Field ${componentName}.${fieldName} missing label, adding default`);
        field.label = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      }

      // CRITICAL: Puck only accepts specific properties on field definitions
      // Keep only allowed properties: type, label, and options (for select/radio)
      const allowedProps = ['type', 'label', 'options'];
      const extraProps = Object.keys(field).filter(key => !allowedProps.includes(key));
      if (extraProps.length > 0) {
        console.warn(`[AI Generator] Field ${componentName}.${fieldName} has unexpected properties: ${extraProps.join(', ')}. Removing them.`);
        extraProps.forEach(prop => delete field[prop]);
      }

      // Validate options if present
      if (field.options && !Array.isArray(field.options)) {
        console.warn(`[AI Generator] Field ${componentName}.${fieldName} has invalid options (not an array), removing`);
        delete field.options;
      }
    }
  }

  console.log('[AI Generator] ✓ Successfully parsed and validated response');
  console.log('[AI Generator] Generated data:');
  console.log('  - Content items:', generated.data.content?.length || 0);
  console.log('[AI Generator] Generated config:');
  console.log('  - Components:', Object.keys(generated.config.components || {}).length);

  // Debug: Log the entire config structure to identify issues
  console.log('[AI Generator] Final config structure:');
  for (const [componentName, component] of Object.entries(generated.config.components)) {
    const comp = component as any;
    console.log(`  ${componentName}:`);
    console.log(`    label: "${comp.label}"`);
    console.log(`    fields: ${Object.keys(comp.fields).length} field(s)`);
    for (const [fieldName, field] of Object.entries(comp.fields)) {
      console.log(`      ${fieldName}: ${JSON.stringify(field)}`);
    }
    console.log(`    render: ${typeof comp.render} (${comp.render.substring(0, 80)}...)`);
  }

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
