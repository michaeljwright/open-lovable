import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // If Firecrawl disabled (default), return stubbed result
    if (process.env.FIRECRAWL_DISABLED !== 'false') {
      return NextResponse.json({ success: true, screenshot: null, metadata: {} });
    }

    // Original Firecrawl call (disabled by default)
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, formats: ['screenshot'], onlyMainContent: false })
    });
    const data = await resp.json();
    const screenshot = data?.data?.screenshot || data?.screenshot || null;
    return NextResponse.json({ success: true, screenshot, metadata: data?.data?.metadata || {} });

  } catch (error: any) {
    console.error('[scrape-screenshot] Screenshot capture error:', error);
    console.error('[scrape-screenshot] Error stack:', error.stack);
    
    // Provide fallback response for development - removed NODE_ENV check as it doesn't work in Next.js production builds
    
    return NextResponse.json({ 
      error: error.message || 'Failed to capture screenshot'
    }, { status: 500 });
  }
}