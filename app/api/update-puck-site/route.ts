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

const UPDATE_SYSTEM_PROMPT = `You are an expert at updating structured Puck editor configurations for websites. You're helping a user EDIT their existing site through natural language.

CONTEXT - PUCK EDITOR:
Puck is a visual page builder for React with two key parts:
1. **DATA** - The actual content/structure of the site (what components are on the page and their props)
2. **CONFIG** - Component definitions that define how each component looks and behaves

You will receive:
- The CURRENT Puck data (existing site structure with all sections/components)
- The CURRENT Puck config (definitions for all available components)
- A USER REQUEST describing what they want to change/add/remove

Your task: Generate UPDATED data and config that applies the user's requested changes while preserving everything else.

CRITICAL EDITING PRINCIPLES:
1. **PRESERVE EVERYTHING unless explicitly asked to change it**
   - If user says "add a testimonials section", keep ALL existing sections and ADD a new one
   - If user says "change the hero title", only modify that specific title prop
   - If user says "remove the pricing section", only remove that section

2. **UNDERSTAND THE CONTEXT**
   - Read the current data carefully to see what's already there
   - Look at existing component types and styling patterns
   - Match the design style when adding new components
   - Keep IDs unique and consistent (e.g., "hero-1", "testimonials-1")

3. **ADD vs MODIFY vs REMOVE**
   - ADD: Insert into data.content array (and add to config.components if new type)
   - MODIFY: Update specific props in existing data.content items
   - REMOVE: Filter out from data.content array (keep in config for reusability)
   - Default position: Add new sections at the END unless user specifies location

4. **COMPONENT CONSISTENCY**
   - Use the same styling approach as existing components
   - If site uses gradients, use gradients in new sections
   - If site uses specific colors (like purple #805cf5), continue using them
   - Match padding, spacing, and layout patterns

PUCK DATA STRUCTURE:
{
  "content": [
    {
      "type": "Hero",           // Component type from config
      "props": {
        "id": "hero-1",         // Unique identifier
        "title": "Welcome",
        "subtitle": "...",
        // ... other component-specific props
      }
    },
    {
      "type": "Features",
      "props": {
        "id": "features-1",
        "heading": "Our Features",
        "features": [
          {"title": "Fast", "description": "Lightning quick"}
        ]
      }
    }
  ],
  "root": {
    "props": {
      "title": "Site Title",    // Overall site metadata
      "theme": "light"
    }
  },
  "zones": {}                    // For advanced layouts (usually empty)
}

PUCK CONFIG STRUCTURE:
{
  "components": {
    "Hero": {
      "label": "Hero Section",
      "fields": {
        "title": { "type": "text", "label": "Title" },
        "subtitle": { "type": "text", "label": "Subtitle" }
      },
      "render": "({ title, subtitle }) => React.createElement('div', {style: {padding: 60, textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}, React.createElement('h1', {style: {fontSize: 48, fontWeight: 'bold', color: 'white', marginBottom: 16}}, title), React.createElement('p', {style: {fontSize: 20, color: 'rgba(255,255,255,0.9)'}}, subtitle))"
    }
  }
}

RENDER FUNCTION FORMAT (MUST BE STRINGS):
- Use React.createElement() instead of JSX
- Keep on ONE SINGLE LINE (no line breaks in the string)
- Use inline styles as JavaScript objects
- Escape quotes properly in strings
- Common pattern: React.createElement('div', {style: {...}}, children)
- For multiple children: React.createElement('div', {}, child1, child2, child3)
- For arrays: React.createElement('div', {}, array.map(item => React.createElement(...)))

Example:
"({ title, items }) => React.createElement('div', {style: {padding: 40}}, React.createElement('h2', {style: {fontSize: 32}}, title), React.createElement('div', {style: {display: 'flex', gap: 20}}, items.map((item, i) => React.createElement('div', {key: i, style: {padding: 20}}, item.text))))"

FIELD TYPES:
- "text" - Single line text input
- "textarea" - Multi-line text
- "number" - Numeric input
- "radio" - Radio buttons (requires "options" array)
- "select" - Dropdown (requires "options" array)
- "array" - Array of objects (requires "arrayFields" object)

Example with array (CRITICAL - must include getItemSummary and defaultItemProps for editability):
"features": {
  "type": "array",
  "label": "Features",
  "arrayFields": {
    "title": { "type": "text", "label": "Title" },
    "description": { "type": "textarea", "label": "Description" }
  },
  "defaultItemProps": {
    "title": "New Feature",
    "description": "Description"
  },
  "getItemSummary": "(item, i) => item.title || `Feature ${i + 1}`"
}

COMMON EDITING SCENARIOS:

1. "Add a testimonials section"
   → Add new component to data.content with type "Testimonials"
   → Add "Testimonials" definition to config.components if it doesn't exist
   → Use similar styling to other sections
   → Include sample testimonial data

2. "Change the hero title to 'Welcome to Our Platform'"
   → Find Hero component in data.content
   → Update only the title prop
   → Keep everything else identical

3. "Remove the pricing section"
   → Remove Pricing component from data.content array
   → Keep Pricing in config.components (for reusability)

4. "Make the hero background purple"
   → Update Hero component render function in config
   → Change background style to purple gradient
   → Keep render function as single-line string

5. "Add a contact form after the hero"
   → Insert ContactForm into data.content at index 1
   → Add ContactForm to config.components if needed

CRITICAL: Grid Layout & Item Count Rules:
When creating or modifying grid layouts, the number of items MUST match the grid columns:
- **2-column grid** → Use 2, 4, 6, or 8 items
- **3-column grid** → Use 3, 6, or 9 items
- **4-column grid** → Use 4, 8, or 12 items

Examples:
- Features with 3-column grid → 3 or 6 items (NOT 4 or 5)
- Testimonials with 2-column grid → 2 or 4 items (NOT 3)
- Team with 4-column grid → 4 or 8 items (NOT 5 or 6)
- Pricing usually has 3 tiers → Use 3-column grid

NEVER create mismatched layouts!

STYLING GUIDELINES:
- Use modern, professional designs
- Common color: Purple (#805cf5, #667eea, #764ba2)
- Padding: 40-80px for sections
- Font sizes: 48px for h1, 32px for h2, 18px for body
- Use flexbox for layouts (display: 'flex', flexDirection: 'column/row', gap: 20)
- Add subtle shadows: boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
- Use gradients: background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
- White text on dark backgrounds, dark text (#333) on light
- Border radius: 8-12px for cards and buttons

RESPONSE FORMAT:
{
  "data": {
    "content": [/* array of components */],
    "root": { "props": { "title": "...", "theme": "..." } },
    "zones": {}
  },
  "config": {
    "components": {
      "ComponentName": {
        "label": "...",
        "fields": { /* ... */ },
        "render": "..." // SINGLE LINE STRING
      }
    }
  }
}

CRITICAL JSON RULES:
1. ALL strings use DOUBLE QUOTES (")
2. Render functions are strings - MUST be single line, no line breaks
3. Escape special characters properly (use \\" for quotes inside strings)
4. No trailing commas
5. Use null instead of undefined
6. Validate JSON is parseable
7. For nested quotes in render functions: Use single quotes for HTML attributes, double quotes for JSON

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
              fields: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    label: { type: "string" },
                    arrayFields: {
                      type: "object",
                      additionalProperties: {
                        type: "object",
                        properties: {
                          type: { type: "string" },
                          label: { type: "string" }
                        }
                      }
                    },
                    options: { type: "array" }
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
    max_tokens: 20000,
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

  // Validate and fix field definitions to ensure they all have type and label
  console.log('[AI Updater] Validating field definitions...');
  for (const [componentName, componentDef] of Object.entries(generated.config.components)) {
    const component = componentDef as any;

    // Ensure component has required properties
    if (!component.label) {
      console.warn(`[AI Updater] Component ${componentName} missing label, adding default`);
      component.label = componentName;
    }
    if (!component.fields) {
      console.warn(`[AI Updater] Component ${componentName} missing fields, adding empty object`);
      component.fields = {};
    }
    if (!component.render) {
      console.warn(`[AI Updater] Component ${componentName} missing render function, adding default`);
      component.render = `() => React.createElement('div', {}, '${componentName}')`;
    }

    // Validate each field has type and label, and clean up unexpected properties
    for (const [fieldName, fieldDef] of Object.entries(component.fields)) {
      const field = fieldDef as any;

      // Ensure required properties exist
      if (!field.type) {
        console.warn(`[AI Updater] Field ${componentName}.${fieldName} missing type, defaulting to 'text'`);
        field.type = 'text';
      }
      if (!field.label) {
        console.warn(`[AI Updater] Field ${componentName}.${fieldName} missing label, adding default`);
        field.label = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      }

      // CRITICAL: Puck only accepts specific properties on field definitions
      // Keep only allowed properties: type, label, options (for select/radio), arrayFields, defaultItemProps, getItemSummary (for arrays)
      const allowedProps = ['type', 'label', 'options', 'arrayFields', 'defaultItemProps', 'getItemSummary', 'min', 'max'];
      const extraProps = Object.keys(field).filter(key => !allowedProps.includes(key));
      if (extraProps.length > 0) {
        console.warn(`[AI Updater] Field ${componentName}.${fieldName} has unexpected properties: ${extraProps.join(', ')}. Removing them.`);
        extraProps.forEach(prop => delete field[prop]);
      }

      // Validate options if present
      if (field.options && !Array.isArray(field.options)) {
        console.warn(`[AI Updater] Field ${componentName}.${fieldName} has invalid options (not an array), removing`);
        delete field.options;
      }

      // Validate arrayFields if present (for array type fields)
      if (field.type === 'array') {
        // Ensure array fields have required properties for editability
        if (!field.arrayFields || typeof field.arrayFields !== 'object') {
          console.warn(`[AI Updater] Array field ${componentName}.${fieldName} missing or invalid arrayFields, adding default`);
          field.arrayFields = { value: { type: 'text', label: 'Value' } };
        }

        // Add getItemSummary if missing (critical for Puck editability)
        if (!field.getItemSummary) {
          console.warn(`[AI Updater] Array field ${componentName}.${fieldName} missing getItemSummary, adding default`);
          field.getItemSummary = `(item, i) => item.title || item.name || \`Item \${i + 1}\``;
        }

        // Add defaultItemProps if missing
        if (!field.defaultItemProps) {
          console.warn(`[AI Updater] Array field ${componentName}.${fieldName} missing defaultItemProps, adding default`);
          const defaultProps: any = {};
          for (const [arrayFieldName, arrayFieldDef] of Object.entries(field.arrayFields)) {
            const arrayField = arrayFieldDef as any;
            if (arrayField.type === 'text' || arrayField.type === 'textarea') {
              defaultProps[arrayFieldName] = 'New item';
            } else if (arrayField.type === 'number') {
              defaultProps[arrayFieldName] = 0;
            }
          }
          field.defaultItemProps = defaultProps;
        }

        // Validate each arrayField has type and label
        for (const [arrayFieldName, arrayFieldDef] of Object.entries(field.arrayFields)) {
          const arrayField = arrayFieldDef as any;
          if (!arrayField.type) {
            console.warn(`[AI Updater] ArrayField ${componentName}.${fieldName}.${arrayFieldName} missing type, defaulting to 'text'`);
            arrayField.type = 'text';
          }
          if (!arrayField.label) {
            console.warn(`[AI Updater] ArrayField ${componentName}.${fieldName}.${arrayFieldName} missing label, adding default`);
            arrayField.label = arrayFieldName.charAt(0).toUpperCase() + arrayFieldName.slice(1);
          }
          // Remove extra properties from arrayFields
          const arrayFieldAllowedProps = ['type', 'label', 'options'];
          const arrayFieldExtraProps = Object.keys(arrayField).filter(key => !arrayFieldAllowedProps.includes(key));
          if (arrayFieldExtraProps.length > 0) {
            console.warn(`[AI Updater] ArrayField ${componentName}.${fieldName}.${arrayFieldName} has unexpected properties: ${arrayFieldExtraProps.join(', ')}. Removing them.`);
            arrayFieldExtraProps.forEach(prop => delete arrayField[prop]);
          }
        }
      }
    }
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
      // Special handling for function keys - they should be unquoted function strings
      let serializedValue;
      if ((key === 'render' || key === 'getItemSummary') && typeof value === 'string') {
        // If render or getItemSummary is a string (function code from AI), don't quote it
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
