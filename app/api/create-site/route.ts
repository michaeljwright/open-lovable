import { NextRequest, NextResponse } from 'next/server';
import { generateSiteWithAI } from '@/lib/ai-site-generator';

export async function POST(req: NextRequest) {
  try {
    console.log('[create-site] Received POST request');
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      console.error('[create-site] Invalid prompt:', prompt);
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 });
    }

    console.log('[create-site] ════════════════════════════════════════');
    console.log('[create-site] Generating site with AI for prompt:', prompt);
    console.log('[create-site] ════════════════════════════════════════');

    // Use AI to generate the site structure
    const generated = await generateSiteWithAI(prompt);

    console.log('[create-site] AI generation complete, serializing config...');

    // Convert config to JavaScript string
    const configJs = serializeConfig(generated.config);

    console.log('[create-site] Config serialized, length:', configJs.length);
    // console.log('[create-site] Config preview:', configJs.substring(0, 300) + '...');

    console.log('[create-site] ════════════════════════════════════════');
    console.log('[create-site] ✓ Successfully generated site');
    console.log('[create-site]   - Components:', Object.keys(generated.config.components).length);
    console.log('[create-site]   - Content items:', generated.data.content.length);
    console.log('[create-site]   - Config JS length:', configJs.length);
    console.log('[create-site] ════════════════════════════════════════');

    return NextResponse.json({
      success: true,
      puck: {
        data: generated.data,
        configJs
      }
    });
  } catch (err: any) {
    console.error('[create-site] ════════════════════════════════════════');
    console.error('[create-site] ✗ Error generating site:', err);
    console.error('[create-site] Error message:', err?.message);
    console.error('[create-site] Error stack:', err?.stack);
    console.error('[create-site] ════════════════════════════════════════');

    return NextResponse.json({
      success: false,
      error: err?.message || 'failed'
    }, { status: 500 });
  }
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
