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

REFERENCE EXAMPLE:
For additional inspiration and structure patterns, refer to this Puck demo configuration:
https://raw.githubusercontent.com/puckeditor/puck/refs/heads/main/apps/demo/config/initial-data.ts

This shows how to structure data with proper zones, array fields, and editable components.

// ============================================
// PUCK DATA STRUCTURE TEMPLATE (Based on official Puck demo)
// ============================================

EXPECTED DATA STRUCTURE FORMAT:
{
  "data": {
    "content": [
      // Array of component instances
      {
        "type": "ComponentName",  // Must match config.components key
        "props": {
          // Component-specific props
          "id": "ComponentName-unique-id",  // Required: unique ID per instance
          "title": "Text content",
          "description": "Text content",
          "imageUrl": "https://...",  // If component uses images
          // For components with arrays (buttons, items, etc.):
          "buttons": [
            {
              "label": "Button Text",
              "href": "https://...",
              "variant": "primary" | "secondary"
            }
          ],
          // For Grid components with nested items:
          "items": [
            {
              "type": "Card",
              "props": {
                "id": "Card-unique-id",
                "title": "Card Title",
                "description": "Card description",
                "icon": "icon-name",
                "layout": {
                  "grow": true,
                  "spanCol": 1,
                  "spanRow": 1,
                  "padding": "0px"
                }
              }
            }
          ],
          // Layout properties (when component supports them):
          "layout": {
            "padding": "0px",
            "spanCol": 1,
            "spanRow": 1,
            "grow": true
          },
          // Alignment and sizing:
          "align": "left" | "center" | "right",
          "size": "s" | "m" | "l" | "xl" | "xxl",
          "padding": "128px",  // Can be string or number
          "direction": "vertical" | "horizontal"
        },
        "readOnly": {  // Optional: mark props as read-only in editor
          "title": false,
          "description": false
        }
      }
    ],
    "root": {
      "props": {
        "title": "Page Title"  // Root-level page properties
      }
    },
    "zones": {}  // Usually empty for simple pages, used for nested zones
  },
  "config": {
    "components": {
      "ComponentName": {
        "label": "Human Readable Name",
        "fields": {
          // Field definitions for Puck editor
          "title": {
            "type": "text",
            "label": "Title"
          },
          "description": {
            "type": "textarea",
            "label": "Description"
          },
          "imageUrl": {
            "type": "text",
            "label": "Image URL"
          },
          // Array field (for repeatable items like buttons, features, etc.):
          "buttons": {
            "type": "array",
            "label": "Buttons",
            "arrayFields": {
              "label": { "type": "text", "label": "Button Label" },
              "href": { "type": "text", "label": "Button URL" },
              "variant": {
                "type": "radio",
                "label": "Button Style",
                "options": [
                  { "label": "Primary", "value": "primary" },
                  { "label": "Secondary", "value": "secondary" }
                ]
              }
            },
            "defaultItemProps": {
              "label": "Button",
              "href": "#",
              "variant": "primary"
            },
            "getItemSummary": "(item, i) => item.label || 'Button ' + (i + 1)"
          },
          // Nested array for Grid items:
          "items": {
            "type": "array",
            "label": "Grid Items",
            "arrayFields": {
              "title": { "type": "text", "label": "Item Title" },
              "description": { "type": "textarea", "label": "Item Description" },
              "icon": { "type": "text", "label": "Icon" }
            },
            "defaultItemProps": {
              "title": "New Item",
              "description": "Description",
              "icon": "✨"
            },
            "getItemSummary": "(item, i) => item.title || 'Item ' + (i + 1)"
          }
        },
        "defaultProps": {
          // Default props when component is first added
          "title": "Default Title",
          "description": "Default description"
        },
        // CRITICAL: Render function as STRING using React.createElement
        "render": "({ title, description, buttons = [] }) => React.createElement('section', {style: {padding: '80px 20px'}}, React.createElement('h1', {style: {fontSize: '42px'}}, title), React.createElement('p', null, description), buttons.map((btn, i) => React.createElement('a', {key: i, href: btn.href, style: {padding: '12px 24px'}}, btn.label)))"
      }
    }
  }
}

COMMON COMPONENT PATTERNS FROM REFERENCE:

1. Hero Component with Image and Buttons:
{
  "type": "Hero",
  "props": {
    "id": "Hero-{unique-id}",
    "title": "Hero Title",
    "description": "Hero description text",
    "buttons": [
      { "label": "Primary CTA", "href": "/action", "variant": "primary" },
      { "label": "Secondary", "href": "/learn", "variant": "secondary" }
    ],
    "image": {
      "url": "https://images.unsplash.com/...",
      "mode": "inline",  // or "background"
      "content": []
    },
    "padding": "128px",
    "align": "left"
  }
}

2. Grid Component with Nested Card Items:
{
  "type": "Grid",
  "props": {
    "id": "Grid-{unique-id}",
    "gap": 24,
    "numColumns": 3,
    "items": [
      {
        "type": "Card",
        "props": {
          "id": "Card-{unique-id}",
          "title": "Card Title",
          "description": "Card description",
          "icon": "icon-name",
          "mode": "flat" | "card",
          "layout": {
            "grow": true,
            "spanCol": 1,
            "spanRow": 1,
            "padding": "0px"
          }
        }
      }
    ]
  }
}

3. Spacing Component:
{
  "type": "Space",
  "props": {
    "id": "Space-{unique-id}",
    "size": "96px",
    "direction": "vertical"
  }
}

4. Heading Component:
{
  "type": "Heading",
  "props": {
    "id": "Heading-{unique-id}",
    "align": "center",
    "level": "1" | "2" | "3" | "4" | "5" | "6",
    "text": "Heading Text",
    "size": "xxl",
    "layout": {
      "padding": "0px"
    }
  }
}

5. Stats Component with Array Items:
{
  "type": "Stats",
  "props": {
    "id": "Stats-{unique-id}",
    "items": [
      { "title": "Stat Label", "description": "100K+" },
      { "title": "Another Stat", "description": "$50K" }
    ]
  }
}

CRITICAL REQUIREMENTS:
1. Every component in data.content MUST have a matching entry in config.components
2. Every component instance MUST have a unique "id" prop
3. Array fields MUST include both "defaultItemProps" and "getItemSummary"
4. Render functions MUST be strings using React.createElement syntax
5. IDs should follow pattern: "{ComponentType}-{timestamp or uuid}"
6. Grid items count MUST match grid columns (3-col = 3/6/9 items, 2-col = 2/4/6/8 items)
7. Nested items in Grid must have their own type and props structure

IMPORTANT RULES:
1. Create a complete, visually appealing website with multiple sections
2. Each section should be a component in BOTH data.content AND config.components
3. Render functions must be STRING representations using React.createElement()
4. Use modern, clean design with proper styling
5. Make the site fully functional and ready to edit
6. CREATE VARIETY - Different sites should have DIFFERENT layouts, structures, and component arrangements
7. USE ARRAY FIELDS for repeatable content (features, testimonials, team members, pricing tiers, etc.)
8. INCLUDE GRAPHICS - Use images, icons, and visual elements to create professional, modern, visually pleasing designs

LAYOUT VARIETY - Analyze the user's request and choose appropriate layouts:
- **SaaS/Startup**: Hero → Features (3-column grid) → Testimonials → Pricing → CTA → Footer
- **Portfolio**: Hero with large image → Project Grid → About (side-by-side) → Contact → Footer
- **Blog/Content**: Header → Featured posts (2-column) → Article grid → Newsletter signup → Footer
- **E-commerce**: Hero banner → Product grid → Benefits → Social proof → Footer
- **Agency**: Full-width hero → Services (4-column) → Case studies → Team → CTA → Footer
- **Landing Page**: Hero → Problem/Solution → Benefits → Testimonials → Pricing → FAQ → CTA
- **Restaurant**: Hero with food image → Menu sections → Gallery → Reservations → Location/Hours
- **Personal Brand**: Large hero → About story → Skills/Services → Work samples → Contact

VISUAL VARIETY - Mix up the styling based on the site type:
- Color schemes: Tech (purples/blues), Creative (bold colors), Professional (navy/grays), Eco (greens), Luxury (golds/blacks)
- Layout patterns: Alternating left/right content, centered sections, full-bleed images, card grids, masonry layouts
- Typography: Modern sans-serif for tech, serif for editorial, bold for creative, clean for minimal

GRAPHICS & VISUAL ELEMENTS - Create professional, modern, visually pleasing designs:

**When to Use Images:**
- Hero sections: Large background images or side-by-side layouts with imagery
- About sections: Team photos, office images, or product shots
- Portfolio/Gallery: Project screenshots, work samples
- Testimonials: Customer/client profile photos
- Product showcases: High-quality product images
- Blog posts: Featured images, article headers

**Image URLs (Use placeholder services for realistic mockups):**
- Hero images: "https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=600&fit=crop" (generic tech/business)
- Team photos: "https://i.pravatar.cc/150?img=[1-70]" (avatar placeholders)
- Product images: "https://images.unsplash.com/photo-[relevant-id]?w=800&h=600&fit=crop"
- Abstract backgrounds: Use gradients or solid colors with overlay patterns
- ALWAYS make images editable fields so users can replace them

**Icons & Emojis:**
- Use emojis for feature cards: ✨ 🚀 💡 ⚡ 🎯 🔒 📱 🌟 💪 🎨 📊 🔥
- Icon guidelines: Use emojis (simpler) or describe icon needs in comments
- Place icons above or beside headings in feature cards
- Use consistently sized icons (48-64px for large, 24-32px for small)

**Visual Design Principles:**
1. **Hierarchy**: Clear visual hierarchy with size, weight, and spacing
2. **Contrast**: Strong contrast between text and backgrounds (WCAG AA minimum)
3. **Whitespace**: Generous padding and margins (never cramped)
4. **Alignment**: Everything aligned to a grid system
5. **Consistency**: Repeated patterns for similar elements

**Professional Polish:**
- Background patterns: Subtle gradients, mesh gradients, or geometric patterns
- Shadows & Depth: Use box-shadow for cards (0 4px 6px rgba(0,0,0,0.1))
- Border radius: Consistent rounding (8px buttons, 12px cards, 16px large sections)
- Hover states: Add cursor:pointer and subtle opacity/transform changes
- Color palette: 1 primary color + 2-3 neutral grays + semantic colors
- Image styling: border-radius, object-fit: 'cover', proper aspect ratios

**Layout Techniques for Visual Appeal:**
- Alternating sections: Light background → Dark background → Light
- Split sections: 50/50 content and image side-by-side
- Overlapping elements: Cards that overlap section boundaries
- Full-width images: Background images with overlay text
- Grid layouts: 2, 3, or 4 column grids with gap spacing

**CRITICAL: Grid Layout & Item Count Rules:**
When creating grid layouts, the number of items MUST match the grid columns to avoid awkward layouts:
- **2-column grid** (gridTemplateColumns: 'repeat(2, 1fr)') → Use 2, 4, 6, or 8 items
- **3-column grid** (gridTemplateColumns: 'repeat(3, 1fr)') → Use 3, 6, or 9 items
- **4-column grid** (gridTemplateColumns: 'repeat(4, 1fr)') → Use 4, 8, or 12 items

Examples:
- Features section with 3-column grid → Generate exactly 3 or 6 feature items
- Testimonials with 2-column grid → Generate exactly 2 or 4 testimonial items
- Team members with 4-column grid → Generate exactly 4 or 8 team member items
- Pricing tiers usually 3 items → Use 3-column grid

NEVER create mismatched layouts like 3-column grid with 4 items!

**Example Image Field in Component:**
"imageUrl": { "type": "text", "label": "Image URL" }

**Example with Image in Render Function:**
React.createElement('img', {
  src: imageUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=600&fit=crop',
  alt: title,
  style: {
    width: '100%',
    height: '400px',
    objectFit: 'cover',
    borderRadius: '12px'
  }
})

PUCK DATA STRUCTURE:
{
  "content": [
    {
      "type": "ComponentName",
      "props": {
        "id": "unique-id",
        // component-specific props
        // Use ARRAYS for repeatable items:
        "items": [
          {"title": "Item 1", "description": "...", "icon": "✨"},
          {"title": "Item 2", "description": "...", "icon": "🚀"}
        ]
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

PUCK CONFIG STRUCTURE WITH ARRAY FIELDS:
{
  "components": {
    "ComponentName": {
      "label": "Display Name",
      "fields": {
        "title": { "type": "text", "label": "Title" },
        "items": {
          "type": "array",
          "label": "Items",
          "arrayFields": {
            "title": { "type": "text", "label": "Item Title" },
            "description": { "type": "textarea", "label": "Item Description" },
            "icon": { "type": "text", "label": "Icon/Emoji" }
          }
        }
      },
      "render": "({ title, items = [] }) => React.createElement('section', {style: {padding: '80px 20px'}}, React.createElement('h2', {style: {fontSize: '36px', marginBottom: '40px', textAlign: 'center'}}, title), React.createElement('div', {style: {display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '1200px', margin: '0 auto'}}, items.map((item, i) => React.createElement('div', {key: i, style: {padding: '30px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}, React.createElement('div', {style: {fontSize: '32px', marginBottom: '12px'}}, item.icon), React.createElement('h3', {style: {fontSize: '20px', fontWeight: '600', marginBottom: '8px'}}, item.title), React.createElement('p', {style: {color: '#666'}}, item.description)))))"
    }
  }
}

RENDER FUNCTION FORMAT (as strings):
- Use React.createElement() instead of JSX
- Use .map() for rendering arrays: items.map((item, i) => React.createElement(...))
- Always add default values for arrays: items = []
- Keep functions readable but on single lines
- Use inline styles with CSS-in-JS objects
- Escape quotes properly
- Common patterns:
  * Headings: "React.createElement('h1', {style: {fontSize: '48px', fontWeight: 'bold', color: '#1a202c'}}, title)"
  * Sections: "React.createElement('section', {style: {padding: '80px 20px', backgroundColor: '#f7fafc'}}, ...)"
  * Containers: "React.createElement('div', {style: {maxWidth: '1200px', margin: '0 auto'}}, ...)"
  * Grids: "React.createElement('div', {style: {display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px'}}, ...)"
  * Buttons: "React.createElement('button', {style: {padding: '12px 24px', backgroundColor: '#805cf5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}}, buttonText)"
  * Arrays: "items.map((item, i) => React.createElement('div', {key: i}, ...))"

COMPONENT TYPES (choose based on user request):
1. **Hero** - Main landing section with heading, description, CTA buttons
   - Include background image or side-by-side image
   - Make imageUrl editable field
   - No grid needed (full-width section)
2. **Features/Benefits** - Grid of feature cards with icons/emojis, titles, descriptions
   - Use array field with icon/emoji for each item
   - **3-column grid = 3 or 6 items** (most common)
   - **4-column grid = 4 or 8 items** (for simple features)
   - **2-column grid = 2 or 4 items** (for detailed features)
3. **About/Story** - About section with image and text
   - Side-by-side layout with image on left or right
   - Include imageUrl field
   - No grid needed (2-column split section)
4. **Testimonials** - Customer testimonials with names, roles, quotes
   - Use array field with optional avatar images
   - **2-column grid = 2 or 4 items** (most common)
   - **3-column grid = 3 or 6 items** (for shorter testimonials)
5. **Pricing** - Pricing tiers with features, prices, CTA buttons
   - Use array field for pricing cards
   - **3-column grid = 3 items** (standard: Basic, Pro, Enterprise)
   - **2-column grid = 2 items** (if only 2 tiers)
6. **Team** - Team member cards with photos, names, roles
   - Use array field with imageUrl for each member
   - **4-column grid = 4 or 8 items** (most common)
   - **3-column grid = 3 or 6 items** (for larger cards)
7. **Gallery/Portfolio** - Image grid or project showcase
   - Use array field with imageUrl, title, description
   - **3-column grid = 3, 6, or 9 items** (most common)
   - **4-column grid = 4 or 8 items** (for smaller images)
   - **2-column grid = 2, 4, or 6 items** (for large showcase)
8. **Stats** - Number highlights with labels and optional icons
   - Use array field with emoji/icon for visual interest
   - **4-column grid = 4 items** (most common)
   - **3-column grid = 3 items** (alternative)
9. **FAQ** - Frequently asked questions
   - Use array field for Q&A pairs
   - **1-column layout** (stacked, no grid) or **2-column grid = 2, 4, 6, or 8 items**
10. **CTA** - Call-to-action section with button and optional background image
    - No grid needed (centered full-width section)
11. **Contact** - Contact form or information with optional map/location image
    - No grid needed (form layout)
12. **Footer** - Footer with links, social media, copyright
    - Optional grid for footer columns

STYLING GUIDELINES:
- Choose color palettes based on site type (tech: purples/blues, creative: bold colors, professional: navy/grays)
- Vary spacing: compact (40-60px), standard (80-100px), spacious (120-140px)
- Responsive considerations: maxWidth (1200px for content), margin auto for centering
- Use grid layouts with different column counts: 2, 3, or 4 columns
- Clean typography: fontSize in px, fontWeight, lineHeight (1.5-1.6 for body text)
- Box shadows and rounded corners for depth: boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: '8px'
- Image styling: width/height, objectFit: 'cover', borderRadius
- Hover effects: cursor: 'pointer', opacity/transform changes, transition: 'all 0.3s ease'
- Backgrounds: Use gradients, images with overlays, or solid colors
- Visual hierarchy: Large headings (48-56px), subheadings (24-32px), body (16-18px)

FIELD TYPES (ALL fields MUST have both "type" AND "label"):
- { "type": "text", "label": "Title" } for short text (titles, names, etc.)
- { "type": "textarea", "label": "Description" } for longer text (descriptions, content)
- { "type": "number", "label": "Count" } for numeric values
- { "type": "select", "label": "Choose", "options": [{"label": "Option 1", "value": "opt1"}] } for dropdowns
- { "type": "radio", "label": "Select", "options": [{"label": "Option 1", "value": "opt1"}] } for radio buttons
- { "type": "array", "label": "Items", "arrayFields": {...} } for repeatable content lists

ARRAY FIELD FORMAT (CRITICAL FOR EDITABILITY):
{
  "items": {
    "type": "array",
    "label": "Feature Items",
    "arrayFields": {
      "title": { "type": "text", "label": "Feature Title" },
      "description": { "type": "textarea", "label": "Feature Description" },
      "icon": { "type": "text", "label": "Icon or Emoji" }
    },
    "defaultItemProps": {
      "title": "New Feature",
      "description": "Description here",
      "icon": "✨"
    },
    "getItemSummary": "(item, i) => item.title || 'Item ' + (i + 1)"
  }
}

IMPORTANT for getItemSummary:
- Must be a STRING representation of a function (like render functions)
- Takes (item, i) as parameters
- Returns a string label for the item in the list
- Example: "(item, i) => item.title || 'Feature ' + (i + 1)"
- Can use template literals: \`Item \${i + 1}\` or string concat: 'Item ' + (i + 1)

CRITICAL: Every field definition MUST include BOTH "type" and "label" properties or Puck will crash!
For array fields, include "arrayFields" object with nested field definitions.

CRITICAL JSON RULES:
1. ALL strings use DOUBLE QUOTES (")
2. Render functions are strings - escape inner quotes
3. No trailing commas
4. Use null instead of undefined
5. Validate JSON is parseable

EXAMPLE COMPONENTS:

1. **Feature Grid with Icons (WITH EDITABLE ARRAY):**
{
  "FeatureGrid": {
    "label": "Feature Grid",
    "fields": {
      "title": { "type": "text", "label": "Section Title" },
      "subtitle": { "type": "textarea", "label": "Section Subtitle" },
      "features": {
        "type": "array",
        "label": "Features",
        "arrayFields": {
          "icon": { "type": "text", "label": "Icon/Emoji" },
          "title": { "type": "text", "label": "Feature Title" },
          "description": { "type": "textarea", "label": "Feature Description" }
        },
        "defaultItemProps": {
          "icon": "✨",
          "title": "New Feature",
          "description": "Feature description"
        },
        "getItemSummary": "(item, i) => item.title || 'Feature ' + (i + 1)"
      }
    },
    "render": "({ title, subtitle, features = [] }) => React.createElement('section', {style: {padding: '100px 20px', backgroundColor: '#f9fafb'}}, React.createElement('div', {style: {maxWidth: '1200px', margin: '0 auto'}}, React.createElement('div', {style: {textAlign: 'center', marginBottom: '60px'}}, React.createElement('h2', {style: {fontSize: '42px', fontWeight: 'bold', marginBottom: '16px', color: '#1a202c'}}, title), React.createElement('p', {style: {fontSize: '18px', color: '#6b7280', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6'}}, subtitle)), React.createElement('div', {style: {display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px'}}, features.map((feature, i) => React.createElement('div', {key: i, style: {padding: '32px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center', transition: 'transform 0.3s ease'}}, React.createElement('div', {style: {fontSize: '48px', marginBottom: '16px'}}, feature.icon), React.createElement('h3', {style: {fontSize: '22px', fontWeight: '600', marginBottom: '12px', color: '#1f2937'}}, feature.title), React.createElement('p', {style: {fontSize: '16px', color: '#6b7280', lineHeight: '1.6'}}, feature.description))))))"
  }
}

2. **Hero with Background Image:**
{
  "HeroWithImage": {
    "label": "Hero with Image",
    "fields": {
      "title": { "type": "text", "label": "Title" },
      "subtitle": { "type": "textarea", "label": "Subtitle" },
      "buttonText": { "type": "text", "label": "Button Text" },
      "backgroundImage": { "type": "text", "label": "Background Image URL" }
    },
    "render": "({ title, subtitle, buttonText, backgroundImage }) => React.createElement('section', {style: {position: 'relative', padding: '140px 20px', backgroundImage: 'url(' + (backgroundImage || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=600&fit=crop') + ')', backgroundSize: 'cover', backgroundPosition: 'center'}}, React.createElement('div', {style: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)'}}, null), React.createElement('div', {style: {position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto', textAlign: 'center', color: 'white'}}, React.createElement('h1', {style: {fontSize: '56px', fontWeight: 'bold', marginBottom: '20px', lineHeight: '1.2'}}, title), React.createElement('p', {style: {fontSize: '20px', marginBottom: '32px', lineHeight: '1.6', opacity: 0.95}}, subtitle), React.createElement('button', {style: {padding: '16px 40px', backgroundColor: '#805cf5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: '600', cursor: 'pointer', transition: 'transform 0.2s ease'}}, buttonText)))"
  }
}

3. **About with Side-by-Side Image:**
{
  "AboutSection": {
    "label": "About Section",
    "fields": {
      "title": { "type": "text", "label": "Title" },
      "description": { "type": "textarea", "label": "Description" },
      "imageUrl": { "type": "text", "label": "Image URL" },
      "imagePosition": { "type": "radio", "label": "Image Position", "options": [{"label": "Left", "value": "left"}, {"label": "Right", "value": "right"}] }
    },
    "render": "({ title, description, imageUrl, imagePosition = 'right' }) => React.createElement('section', {style: {padding: '80px 20px'}}, React.createElement('div', {style: {maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center'}}, imagePosition === 'left' ? [React.createElement('img', {key: 'img', src: imageUrl || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=600&fit=crop', alt: title, style: {width: '100%', height: '400px', objectFit: 'cover', borderRadius: '12px'}}), React.createElement('div', {key: 'text'}, React.createElement('h2', {style: {fontSize: '42px', fontWeight: 'bold', marginBottom: '20px', color: '#1a202c'}}, title), React.createElement('p', {style: {fontSize: '18px', color: '#4b5563', lineHeight: '1.7'}}, description))] : [React.createElement('div', {key: 'text'}, React.createElement('h2', {style: {fontSize: '42px', fontWeight: 'bold', marginBottom: '20px', color: '#1a202c'}}, title), React.createElement('p', {style: {fontSize: '18px', color: '#4b5563', lineHeight: '1.7'}}, description)), React.createElement('img', {key: 'img', src: imageUrl || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=600&fit=crop', alt: title, style: {width: '100%', height: '400px', objectFit: 'cover', borderRadius: '12px'}})]))"
  }
}

CRITICAL REMINDERS:
1. **Include Images**: Add imageUrl fields to Hero, About, Team, Portfolio, Testimonials sections
2. **Use Icons/Emojis**: Every feature card, stat, or benefit should have a visual icon/emoji
3. **Professional Design**: Modern layouts, proper spacing, visual hierarchy, and polished styling
4. **Make It Editable**: All images, icons, and text should be editable fields
5. **Visual Appeal**: Use backgrounds (gradients/images), shadows, rounded corners, and proper contrast
6. **Default to Beauty**: Even with placeholder content, the site should look professional and modern
7. **MATCH GRID & ITEMS**: 2-col grid = 2/4/6/8 items, 3-col grid = 3/6/9 items, 4-col grid = 4/8/12 items
8. **ARRAY EDITABILITY**: EVERY array field MUST have both "getItemSummary" and "defaultItemProps" or items won't be editable in Puck!

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
    max_tokens: 20000,
    temperature: 0.9,
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
      // Keep only allowed properties: type, label, options (for select/radio), arrayFields, defaultItemProps, getItemSummary (for arrays)
      const allowedProps = ['type', 'label', 'options', 'arrayFields', 'defaultItemProps', 'getItemSummary', 'min', 'max'];
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

      // Validate arrayFields if present (for array type fields)
      if (field.type === 'array') {
        // Ensure array fields have required properties for editability
        if (!field.arrayFields || typeof field.arrayFields !== 'object') {
          console.warn(`[AI Generator] Array field ${componentName}.${fieldName} missing or invalid arrayFields, adding default`);
          field.arrayFields = { value: { type: 'text', label: 'Value' } };
        }

        // Add getItemSummary if missing (critical for Puck editability)
        if (!field.getItemSummary) {
          console.warn(`[AI Generator] Array field ${componentName}.${fieldName} missing getItemSummary, adding default`);
          field.getItemSummary = `(item, i) => item.title || item.name || \`Item \${i + 1}\``;
        }

        // Add defaultItemProps if missing
        if (!field.defaultItemProps) {
          console.warn(`[AI Generator] Array field ${componentName}.${fieldName} missing defaultItemProps, adding default`);
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
            console.warn(`[AI Generator] ArrayField ${componentName}.${fieldName}.${arrayFieldName} missing type, defaulting to 'text'`);
            arrayField.type = 'text';
          }
          if (!arrayField.label) {
            console.warn(`[AI Generator] ArrayField ${componentName}.${fieldName}.${arrayFieldName} missing label, adding default`);
            arrayField.label = arrayFieldName.charAt(0).toUpperCase() + arrayFieldName.slice(1);
          }
          // Remove extra properties from arrayFields
          const arrayFieldAllowedProps = ['type', 'label', 'options'];
          const arrayFieldExtraProps = Object.keys(arrayField).filter(key => !arrayFieldAllowedProps.includes(key));
          if (arrayFieldExtraProps.length > 0) {
            console.warn(`[AI Generator] ArrayField ${componentName}.${fieldName}.${arrayFieldName} has unexpected properties: ${arrayFieldExtraProps.join(', ')}. Removing them.`);
            arrayFieldExtraProps.forEach(prop => delete arrayField[prop]);
          }
        }
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
