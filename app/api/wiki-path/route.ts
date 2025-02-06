import { NextResponse } from "next/server";
import NodeCache from "node-cache";

const linksCache = new NodeCache({ stdTTL: 3600 });
const TIMEOUT_MS = 15000;
const MAX_DEPTH = 2;
const CONCURRENT_REQUESTS = 5;

interface QueueItem {
  article: string;
  path: string[];
  depth: number;
}

interface WikiApiResponse {
  query?: {
    pages?: {
      [key: string]: {
        title: string;
        links?: Array<{ title: string }>;
        normalized?: Array<{ from: string; to: string }>;
      };
    };
  };
  error?: {
    info: string;
  };
}

export async function POST(request: Request) {
  try {
    const { startArticle, endArticle } = await request.json();
    
    if (!startArticle || !endArticle) {
      return NextResponse.json(
        { message: "Start and end articles are required" },
        { status: 400 }
      );
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Search timed out')), TIMEOUT_MS);
    });

    const searchPromise = bidirectionalSearch(startArticle, endArticle);

    try {
      const result = await Promise.race([searchPromise, timeoutPromise]);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Search timed out" },
        { status: 408 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { message: "Error processing request" },
      { status: 500 }
    );
  }
}

async function bidirectionalSearch(startArticle: string, endArticle: string) {
  const forwardQueue: QueueItem[] = [{ article: startArticle, path: [startArticle], depth: 0 }];
  const backwardQueue: QueueItem[] = [{ article: endArticle, path: [endArticle], depth: 0 }];
  
  const forwardVisited = new Map<string, string[]>();
  const backwardVisited = new Map<string, string[]>();
  
  forwardVisited.set(startArticle.toLowerCase(), [startArticle]);
  backwardVisited.set(endArticle.toLowerCase(), [endArticle]);

  while (forwardQueue.length > 0 && backwardQueue.length > 0) {
    // Process both directions simultaneously
    const [forwardResult, backwardResult] = await Promise.all([
      expandFrontier(forwardQueue, forwardVisited, backwardVisited, true),
      expandFrontier(backwardQueue, backwardVisited, forwardVisited, false)
    ]);

    if (forwardResult) {
      return { path: forwardResult };
    }
    if (backwardResult) {
      return { path: backwardResult };
    }
  }

  return { path: [], message: "No path found" };
}

async function expandFrontier(
  queue: QueueItem[],
  visited: Map<string, string[]>,
  otherVisited: Map<string, string[]>,
  isForward: boolean,
): Promise<string[] | null> {
  if (queue.length === 0) return null;

  const currentLevel: QueueItem[] = [];
  while (queue.length > 0 && queue[0].depth === queue[0].depth) {
    currentLevel.push(queue.shift()!);
  }

  if (currentLevel[0].depth >= MAX_DEPTH) return null;

  // Process articles in parallel batches
  for (let i = 0; i < currentLevel.length; i += CONCURRENT_REQUESTS) {
    const batch = currentLevel.slice(i, i + CONCURRENT_REQUESTS);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const links = await getLinks(item.article);
        const results: QueueItem[] = [];

        for (const link of links) {
          const linkLower = link.toLowerCase();

          // Check for intersection with other frontier
          if (otherVisited.has(linkLower)) {
            const otherPath = otherVisited.get(linkLower)!;
            if (isForward) {
              return [...item.path, ...otherPath.reverse()];
            } else {
              return [...otherPath, ...item.path.reverse()];
            }
          }

          // Add to queue if not visited
          if (!visited.has(linkLower)) {
            const newPath = [...item.path, link];
            visited.set(linkLower, newPath);
            results.push({
              article: link,
              path: newPath,
              depth: item.depth + 1
            });
          }
        }

        queue.push(...results);
        return null;
      })
    );

    // Check if we found a path
    const foundPath = batchResults.find(result => result !== null);
    if (foundPath) return foundPath;
  }

  return null;
}

async function getLinks(article: string): Promise<string[]> {
  const cached = linksCache.get<string[]>(article);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      action: 'query',
      titles: article,
      prop: 'links',
      pllimit: '500',
      format: 'json',
      origin: '*'
    });

    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`
    );

    const data = await response.json();

    if (!data.query?.pages) {
      return [];
    }

    const page = Object.values(data.query.pages)[0] as { links?: { title: string }[] };
    
    if (!page.links) {
      return [];
    }

    const links = page.links.map(link => link.title);
    linksCache.set(article, links);
    return links;
  } catch (error) {
    console.error('Error fetching links:', error);
    return [];
  }
}

// Helper function to normalize article titles
function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter of each word
    .join('_');
} 