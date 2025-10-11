import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url, formats = ['markdown', 'html'], options = {} } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }
    
    // Bypass Firecrawl by default unless explicitly enabled
    if (process.env.FIRECRAWL_DISABLED !== 'false') {
      return NextResponse.json({
        success: true,
        data: {
          title: "",
          content: "",
          description: "",
          markdown: "",
          html: "",
          metadata: { sourceURL: url, statusCode: 200 },
          screenshot: null,
          links: [],
          raw: null
        }
      });
    }

    // Original Firecrawl path (disabled by default)
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ url, formats, ...options })
    });
    const data = await searchResponse.json();
    return NextResponse.json({ success: true, data });
    
  } catch (error) {
    console.error("Error scraping website:", error);
    
    // Return a more detailed error response
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape website",
      // Provide mock data as fallback for development
      data: {
        title: "Example Website",
        content: "This is fallback content due to an error. Please check your configuration.",
        description: "Error occurred while scraping",
        markdown: `# Error\n\n${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        html: `<h1>Error</h1><p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>`,
        metadata: {
          title: "Error",
          description: "Failed to scrape website",
          statusCode: 500
        }
      }
    }, { status: 500 });
  }
}

// Optional: Add OPTIONS handler for CORS if needed
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}