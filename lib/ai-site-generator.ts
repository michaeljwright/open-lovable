import Anthropic from '@anthropic-ai/sdk';

export interface PuckComponent {
  type: string;
  props: {
    id: string;
    [key: string]: any;
  };
}

export interface PuckData {
  content: PuckComponent[];
  root: {
    props: {
      title: string;
      theme?: string;
    };
  };
  zones: Record<string, any>;
}

export interface PuckConfig {
  components: Record<string, any>;
}

interface GeneratedSite {
  data: PuckData;
  config: PuckConfig;
}

const SYSTEM_PROMPT = `You are an expert at generating structured Puck editor configurations for websites.

Puck is a visual page builder for React. You need to generate:
1. A Puck data structure (content array with components)
2. A Puck config (component definitions with fields and render functions AS STRINGS)

IMPORTANT: Render functions must be provided as STRING representations that will be evaluated later.

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

CRITICAL: The "render" value must be a STRING containing the function code, not an actual function!

AVAILABLE FIELD TYPES: text, textarea, number, select, radio, array, object

COMMON COMPONENT TYPES TO CREATE:
- Hero: Hero sections with title, subtitle, CTA buttons
- Header: Site headers with logo, navigation
- Footer: Site footers with copyright
- FeatureGrid: Grid of features with icons, titles, descriptions
- Testimonials: Customer testimonials
- PricingTable: Pricing tiers
- ContactForm: Contact forms
- TextBlock: Rich text content
- ImageGallery: Image galleries
- FAQ: Frequently asked questions
- Stats: Statistics display
- Team: Team member cards
- CallToAction: CTA sections

RENDER FUNCTION EXAMPLES (as strings with proper escaping):

Hero:
"({ title, subtitle, cta }) => React.createElement('section', {style: {padding: '64px 24px', textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'}}, React.createElement('h1', {style: {fontSize: 48, margin: 0}}, title), React.createElement('p', {style: {fontSize: 20, opacity: 0.9, marginTop: 16}}, subtitle), cta && React.createElement('a', {href: cta.href, style: {display: 'inline-block', marginTop: 24, padding: '12px 32px', background: 'white', color: '#667eea', borderRadius: 8, textDecoration: 'none', fontWeight: 'bold'}}, cta.label))"

Header:
"({ logo, nav }) => React.createElement('header', {style: {display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid #eee'}}, React.createElement('strong', {style: {fontSize: 24}}, logo), React.createElement('nav', {style: {display: 'flex', gap: 24}}, (nav || []).map((item, i) => React.createElement('a', {key: i, href: item.href, style: {textDecoration: 'none', color: '#333'}}, item.label))))"

FeatureGrid:
"({ features }) => React.createElement('section', {style: {padding: '48px 24px'}}, React.createElement('div', {style: {display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24, maxWidth: 1200, margin: '0 auto'}}, (features || []).map((f, i) => React.createElement('div', {key: i, style: {padding: 24, border: '1px solid #eee', borderRadius: 8}}, React.createElement('h3', {style: {margin: 0, marginBottom: 8}}, f.title), React.createElement('p', {style: {color: '#666', margin: 0}}, f.description)))))"

CRITICAL JSON RULES:
1. ALL strings must use DOUBLE QUOTES ("), not single quotes
2. Render functions are strings - keep them on one line, no line breaks
3. Escape special characters properly in strings
4. No trailing commas in objects or arrays
5. Use null instead of undefined
6. Numbers without quotes, booleans without quotes
7. Validate your JSON is parseable before responding

GUIDELINES:
1. Create 4-8 components per site based on user needs
2. Use semantic HTML elements
3. Include inline styles (no CSS classes)
4. Make ALL text content editable via fields
5. Use unique IDs like "hero-1", "features-main", etc.
6. Populate with realistic content based on user's request
7. Structure: Header -> Hero -> Main Content -> Footer
8. Keep render function strings compact and on single lines
9. Test that your JSON is valid before returning it

EXAMPLE RESPONSE STRUCTURE:
{
  "data": {
    "content": [
      {
        "type": "Hero",
        "props": {
          "id": "hero-1",
          "title": "Welcome to ACME",
          "subtitle": "We build amazing things",
          "cta": {"label": "Get Started", "href": "/start"}
        }
      }
    ],
    "root": {"props": {"title": "ACME Corp", "theme": "light"}},
    "zones": {}
  },
  "config": {
    "components": {
      "Hero": {
        "label": "Hero Section",
        "fields": {
          "title": {"type": "text", "label": "Title"},
          "subtitle": {"type": "text", "label": "Subtitle"},
          "cta": {"type": "object", "label": "Call to Action"}
        },
        "render": "({ title, subtitle, cta }) => React.createElement('section', null, React.createElement('h1', null, title))"
      }
    }
  }
}

RESPOND WITH ONLY VALID JSON - no markdown, no explanations, no code blocks, just the raw JSON object.`;

// JSON Schema for structured output
const PUCK_SCHEMA = {
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

export async function generateSiteWithAI(prompt: string): Promise<GeneratedSite> {
  console.log('[AI Generator] Starting site generation...');
  console.log('[AI Generator] User prompt:', prompt);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('[AI Generator] ANTHROPIC_API_KEY is not set!');
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  console.log('[AI Generator] API key found, initializing Anthropic client...');
  const anthropic = new Anthropic({ apiKey });

  console.log('[AI Generator] Sending request to Claude with structured output...');
  console.log('[AI Generator] Model: claude-sonnet-4-20250514');
  console.log('[AI Generator] Max tokens: 20000, Temperature: 0.7');

  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 20000,
    temperature: 0.7,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }
      },
      {
        type: "text",
        text: `You MUST respond with ONLY a valid JSON object matching this exact schema:\n\n${JSON.stringify(PUCK_SCHEMA, null, 2)}\n\nDo not include any markdown, explanations, or text outside the JSON object.`,
        cache_control: { type: "ephemeral" }
      }
    ],
    messages: [
      {
        role: 'user',
        content: `Generate a complete Puck website configuration for this request:\n\n${prompt}\n\nRespond with ONLY the JSON object, nothing else.`
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
  console.log('[AI Generator] Response preview:', content.text.substring(0, 500) + '...');

  // With structured output, the response should be guaranteed valid JSON
  let generated: GeneratedSite;

  try {
    console.log('[AI Generator] Parsing structured JSON output...');
    generated = JSON.parse(content.text) as GeneratedSite;
    console.log('[AI Generator] ✓ Successfully parsed structured output');
  } catch (parseError: any) {
    console.error('[AI Generator] Failed to parse structured output:', parseError.message);
    console.error('[AI Generator] This should not happen with structured output!');
    console.error('[AI Generator] Full response:', content.text);

    // Fallback: try to extract JSON
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        generated = JSON.parse(jsonMatch[0]) as GeneratedSite;
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
    console.error('[AI Generator] Has data:', !!generated.data);
    console.error('[AI Generator] Has config:', !!generated.config);
    throw new Error('Invalid response structure from AI');
  }

  console.log('[AI Generator] ✓ Successfully parsed and validated response');
  console.log('[AI Generator] Data structure:');
  console.log('  - Content items:', generated.data.content?.length || 0);
  console.log('  - Root title:', generated.data.root?.props?.title);
  console.log('  - Theme:', generated.data.root?.props?.theme);

  console.log('[AI Generator] Config structure:');
  const componentNames = Object.keys(generated.config.components || {});
  console.log('  - Components:', componentNames.length);
  console.log('  - Component names:', componentNames.join(', '));

  // Log each component's structure
  componentNames.forEach(name => {
    const comp = generated.config.components[name];
    const fieldNames = Object.keys(comp.fields || {});
    console.log(`  - ${name}: ${fieldNames.length} fields (${fieldNames.join(', ')}), has render: ${!!comp.render}`);
  });

  return generated;
}

// Helper function to convert config object to JavaScript string
export function configToJavaScript(config: PuckConfig): string {
  // Convert the config object to a JavaScript module string
  // This requires special handling for functions
  const configStr = JSON.stringify(config, (key, value) => {
    // Functions need to be converted to strings
    if (typeof value === 'function') {
      return value.toString();
    }
    return value;
  }, 2);

  // Replace stringified functions with actual function code
  const jsCode = configStr
    .replace(/"render":\s*"([^"]+)"/g, (match, funcStr) => {
      return `render: ${funcStr}`;
    });

  return `export const config = ${jsCode};`;
}
