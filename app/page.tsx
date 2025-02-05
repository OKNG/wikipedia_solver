"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import debounce from 'lodash/debounce';

interface ArticleDetails {
  title: string;
  extract?: string;
  thumbnail?: {
    source: string;
  };
}

// Define ArticleCard component outside of the main component
const ArticleCard = ({ 
  title, 
  details 
}: { 
  title: string;
  details?: ArticleDetails;
}) => {
  return (
    <div className="mx-auto w-64 bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
      <div className="p-4">
        <h3 className="text-lg font-bold mb-2 line-clamp-2">
          <a
            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {title}
          </a>
        </h3>
        
        {details?.thumbnail?.source && (
          <div className="relative w-full h-40 mb-4">
            <Image
              src={details.thumbnail.source}
              alt={title}
              fill
              className="object-cover rounded"
              sizes="256px"
            />
          </div>
        )}
        
        {details?.extract ? (
          <p className="text-gray-700 text-sm line-clamp-6">{details.extract}</p>
        ) : (
          <div className="animate-pulse h-20 bg-gray-200 rounded"></div>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const [startArticle, setStartArticle] = useState("");
  const [endArticle, setEndArticle] = useState("");
  const [path, setPath] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  const [startSuggestions, setStartSuggestions] = useState<string[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<string[]>([]);
  const [articleDetails, setArticleDetails] = useState<Map<string, ArticleDetails>>(new Map());

  // Create refs for the dropdown containers
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Modify the click-outside handler to check if click is inside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (startRef.current && !startRef.current.contains(event.target as Node)) {
        setShowStartSuggestions(false);
      }
      if (endRef.current && !endRef.current.contains(event.target as Node)) {
        setShowEndSuggestions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const findShortestPath = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setPath([]);

    try {
      // This is where we'll make the API call to our backend
      const response = await fetch("/api/wiki-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ startArticle, endArticle }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setPath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (query: string): Promise<string[]> => {
    if (!query.trim()) return [];
    
    try {
      const response = await fetch(`/api/wiki-search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      console.log('Received suggestions:', data.suggestions); // Debug log
      return data.suggestions;
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  };

  // Modify the debounced search functions to add logging
  const debouncedStartSearch = debounce(async (value: string) => {
    console.log('Searching for:', value); // Debug log
    const suggestions = await fetchSuggestions(value);
    console.log('Setting start suggestions:', suggestions); // Debug log
    setStartSuggestions(suggestions);
  }, 300);

  const debouncedEndSearch = debounce(async (value: string) => {
    console.log('Searching for:', value); // Debug log
    const suggestions = await fetchSuggestions(value);
    console.log('Setting end suggestions:', suggestions); // Debug log
    setEndSuggestions(suggestions);
  }, 300);

  const handleStartInputChange = (value: string) => {
    setStartArticle(value);
    setShowStartSuggestions(true);
    console.log('Start input changed:', value); // Debug log
    debouncedStartSearch(value);
  };

  const handleEndInputChange = (value: string) => {
    setEndArticle(value);
    setShowEndSuggestions(true);
    console.log('End input changed:', value); // Debug log
    debouncedEndSearch(value);
  };

  const fetchArticleDetails = async (title: string) => {
    if (!title || articleDetails.has(title)) return;
    
    try {
      const response = await fetch(`/api/wiki-article?title=${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error('Failed to fetch article details');
      const data = await response.json();
      setArticleDetails(prev => new Map(prev).set(title, data));
    } catch (error) {
      console.error('Error fetching article details:', error);
    }
  };

  // Update useEffect to fetch details for new path articles
  useEffect(() => {
    if (path.length > 0) {
      path.forEach(article => {
        fetchArticleDetails(article);
      });
    }
  }, [path]);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="text-3xl font-bold">Wikipedia Path Finder</h1>
        
        <form onSubmit={findShortestPath} className="w-full space-y-4">
          <div className="space-y-2 relative" ref={startRef}>
            <label htmlFor="start" className="block">Start Article:</label>
            <input
              id="start"
              type="text"
              value={startArticle}
              onChange={(e) => handleStartInputChange(e.target.value)}
              onFocus={() => setShowStartSuggestions(true)}
              className="w-full p-2 border rounded text-gray-900 placeholder:text-gray-400"
              placeholder="e.g. Albert Einstein"
              required
            />
            {showStartSuggestions && startSuggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border rounded-b shadow-lg max-h-60 overflow-y-auto">
                {startSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="p-2 hover:bg-gray-100 cursor-pointer text-gray-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStartArticle(suggestion);
                      setShowStartSuggestions(false);
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 relative" ref={endRef}>
            <label htmlFor="end" className="block">End Article:</label>
            <input
              id="end"
              type="text"
              value={endArticle}
              onChange={(e) => handleEndInputChange(e.target.value)}
              onFocus={() => setShowEndSuggestions(true)}
              className="w-full p-2 border rounded text-gray-900 placeholder:text-gray-400"
              placeholder="e.g. Quantum Physics"
              required
            />
            {showEndSuggestions && endSuggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border rounded-b shadow-lg max-h-60 overflow-y-auto">
                {endSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="p-2 hover:bg-gray-100 cursor-pointer text-gray-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEndArticle(suggestion);
                      setShowEndSuggestions(false);
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? "Searching..." : "Find Path"}
          </button>
        </form>

        {error && (
          <div className="text-red-500 text-center">
            {error}
          </div>
        )}

        {path.length > 0 && (
          <div className="w-full">
            <h2 className="text-xl font-semibold mb-4">Shortest Path Found ({path.length} steps):</h2>
            <div className="space-y-6">
              {path.map((article, index) => (
                <div key={article} className="flex flex-col items-center gap-4">
                  <ArticleCard 
                    title={article}
                    details={articleDetails.get(article)}
                  />
                  {index < path.length - 1 && (
                    <div className="flex justify-center">
                      <svg 
                        className="w-6 h-6 text-gray-400" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
