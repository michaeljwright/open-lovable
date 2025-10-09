import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    // Firecrawl removed. Return an empty result set for now.
    return NextResponse.json({ results: [] });
  } catch (error) {
    return NextResponse.json({ results: [] });
  }
}