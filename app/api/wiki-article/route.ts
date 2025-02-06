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
  const nextTitle = searchParams.get('nextTitle');
  const isEndArticle = searchParams.get('isEndArticle') === 'true';

  if (!title) {
    return NextResponse.json({ error: "Title parameter is required" }, { status: 400 });
  }

  try {
    const endpoint = 'https://en.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'extracts|pageimages',
      // Only get intro for end article
      exintro: isEndArticle ? 'true' : 'false',
      explaintext: 'true',
      exsentences: isEndArticle ? '3' : '100', // Get more content for finding linking sentence
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
    
    if (!isEndArticle && nextTitle && page.extract) {
      // Find the sentence containing the next article title
      const sentences = page.extract.match(/[^.!?]+[.!?]+/g) || [];
      const linkingSentence = sentences.find(sentence => 
        sentence.toLowerCase().includes(nextTitle.toLowerCase())
      );
      
      if (linkingSentence) {
        page.extract = linkingSentence.trim();
      }
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error('Error fetching article details:', error);
    return NextResponse.json({ error: "Failed to fetch article details" }, { status: 500 });
  }
} 