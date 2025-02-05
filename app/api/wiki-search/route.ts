import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('q');

  if (!search) {
    return NextResponse.json({ suggestions: [] });
  }

  const endpoint = 'https://en.wikipedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'opensearch',
    search,
    limit: '10',
    namespace: '0',
    format: 'json',
    origin: '*',
  });

  try {
    const response = await fetch(`${endpoint}?${params}`);
    const [term, titles] = await response.json();
    
    // Add logging to debug
    console.log('Search term:', term);
    console.log('Suggestions:', titles);
    
    return NextResponse.json({ suggestions: titles });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json({ suggestions: [] });
  }
} 