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

const ArticleCard = ({ 
  title, 
  details,
  index,
  currentIndex,
  total
}: { 
  title: string;
  details?: ArticleDetails;
  index: number;
  currentIndex: number;
  total: number;
}) => {
  const diff = index - currentIndex;
  const scale = 1 - Math.min(Math.abs(diff) * 0.1, 0.3);
  const translateY = diff * 20;
  const zIndex = total - Math.abs(diff);
  const opacity = 1 - Math.abs(diff) * 0.2;

  return (
    <div 
      className="absolute w-64"
      style={{
        transform: `translateX(-50%) translateY(${translateY}px) scale(${scale})`,
        left: '50%',
        zIndex,
        opacity,
        transition: 'all 0.5s ease-out',
      }}
    >
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
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
          
          <div className="relative w-full h-40 mb-4 bg-gray-100">
            {details?.thumbnail?.source ? (
              <Image
                src={details.thumbnail.source}
                alt={title}
                fill
                className="object-cover rounded"
                sizes="256px"
                priority={index === currentIndex}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                {details ? 'No image available' : 'Loading...'}
              </div>
            )}
          </div>
          
          <div className="min-h-[6rem]">
            {details?.extract ? (
              <p className="text-gray-700 text-sm line-clamp-6">{details.extract}</p>
            ) : (
              <div className="space-y-2">
                <div className="animate-pulse h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="animate-pulse h-4 bg-gray-200 rounded w-full"></div>
                <div className="animate-pulse h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            )}
          </div>
        </div>
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
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

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

  const fetchSuggestions = async (query: string, isStart: boolean) => {
    if (!query.trim()) {
      isStart ? setStartSuggestions([]) : setEndSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?` +
        new URLSearchParams({
          action: 'opensearch',
          search: query,
          limit: '5',
          namespace: '0',
          format: 'json',
          origin: '*'
        })
      );

      const [, titles] = await response.json();
      isStart ? setStartSuggestions(titles) : setEndSuggestions(titles);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      isStart ? setStartSuggestions([]) : setEndSuggestions([]);
    }
  };

  // Add debounced versions of the fetch functions
  const debouncedFetchStartSuggestions = debounce(
    (query: string) => fetchSuggestions(query, true),
    300
  );

  const debouncedFetchEndSuggestions = debounce(
    (query: string) => fetchSuggestions(query, false),
    300
  );

  // Update the input handlers
  const handleStartArticleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStartArticle(value);
    debouncedFetchStartSuggestions(value);
  };

  const handleEndArticleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEndArticle(value);
    debouncedFetchEndSuggestions(value);
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

  useEffect(() => {
    if (path.length > 0) {
      path.forEach(article => {
        fetchArticleDetails(article);
      });
    }
  }, [path]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 p-8">
      <main className="max-w-2xl mx-auto flex flex-col gap-8 items-center">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-purple-200">
          Wikipedia Path Finder
        </h1>
        
        <form onSubmit={findShortestPath} className="w-full space-y-4">
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={startArticle}
                onChange={handleStartArticleChange}
                onFocus={() => setShowStartSuggestions(true)}
                placeholder="Start Article"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
              />
              {showStartSuggestions && startSuggestions.length > 0 && (
                <div 
                  className="absolute z-50 w-full mt-2 backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg shadow-xl overflow-hidden"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {startSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full px-4 py-2 text-left text-white/90 hover:bg-white/20 transition-colors"
                      onClick={() => {
                        setStartArticle(suggestion);
                        setShowStartSuggestions(false);
                      }}
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={endArticle}
                onChange={handleEndArticleChange}
                onFocus={() => setShowEndSuggestions(true)}
                placeholder="End Article"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
              />
              {showEndSuggestions && endSuggestions.length > 0 && (
                <div 
                  className="absolute z-50 w-full mt-2 backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg shadow-xl overflow-hidden"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {endSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full px-4 py-2 text-left text-white/90 hover:bg-white/20 transition-colors"
                      onClick={() => {
                        setEndArticle(suggestion);
                        setShowEndSuggestions(false);
                      }}
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

        {loading && (
          <div className="text-center">
            Searching for path...
          </div>
        )}

        {path.length > 0 && (
          <div className="w-full">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Path Found ({currentCardIndex + 1} of {path.length} steps)
            </h2>
            
            <div className="relative h-[500px] w-full mb-8">
              {path.map((article, index) => (
                <ArticleCard 
                  key={article}
                  title={article}
                  details={articleDetails.get(article)}
                  index={index}
                  currentIndex={currentCardIndex}
                  total={path.length}
                />
              ))}
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => setCurrentCardIndex(prev => Math.max(0, prev - 1))}
                disabled={currentCardIndex === 0}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentCardIndex(prev => Math.min(path.length - 1, prev + 1))}
                disabled={currentCardIndex === path.length - 1}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      {(showStartSuggestions || showEndSuggestions) && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowStartSuggestions(false);
            setShowEndSuggestions(false);
          }}
        />
      )}
    </div>
  );
}
