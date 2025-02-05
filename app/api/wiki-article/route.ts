import { NextResponse } from "next/server";

interface WikiArticleResponse {
  query?: {
    pages?: {
      [key: string]: {
        title: string;
        extract?: string;
        thumbnail?: {
          source: string;
        };
      };
    };
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');

  if (!title) {
    return NextResponse.json({ error: "Title parameter is required" }, { status: 400 });
  }

  try {
    // Fetch article details from Wikipedia API
    const endpoint = 'https://en.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'extracts|pageimages',
      exintro: 'true',
      explaintext: 'true',
      exsentences: '3',
      piprop: 'thumbnail',
      pithumbsize: '400',
      format: 'json',
      origin: '*',
    });

    const response = await fetch(`${endpoint}?${params}`);
    const data: WikiArticleResponse = await response.json();

    if (!data.query?.pages) {
      throw new Error('No article data found');
    }

    const page = Object.values(data.query.pages)[0];
    
    // If no Wikipedia image, fetch from Google Custom Search API
    if (!page.thumbnail?.source) {
      try {
        const googleSearchParams = new URLSearchParams({
          key: process.env.GOOGLE_API_KEY || '',
          cx: process.env.GOOGLE_SEARCH_ENGINE_ID || '',
          q: `${title} wikipedia`,
          searchType: 'image',
          num: '1',
        });

        const googleResponse = await fetch(
          `https://www.googleapis.com/customsearch/v1?${googleSearchParams}`
        );
        const googleData = await googleResponse.json();
        
        if (googleData.items?.[0]?.link) {
          page.thumbnail = { source: googleData.items[0].link };
        }
      } catch (error) {
        console.error('Error fetching Google image:', error);
      }
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error('Error fetching article details:', error);
    return NextResponse.json({ error: "Failed to fetch article details" }, { status: 500 });
  }
} 