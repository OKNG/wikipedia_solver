"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import debounce from 'lodash/debounce';
import { useSwipeable } from "react-swipeable";

interface ArticleDetails {
  title: string;
  extract?: string;
  thumbnail?: {
    source: string;
  };
}

const fetchWikiCommonsImage = async (title: string) => {
  try {
    const response = await fetch(
      'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        format: 'json',
        prop: 'images|imageinfo',
        generator: 'search',
        gsrsearch: title,
        gsrnamespace: '6', // File namespace
        gsrlimit: '1',
        iiprop: 'url',
        origin: '*'
      })
    );

    const data = await response.json();
    if (!data.query?.pages) return null;

    const page = Object.values(data.query.pages)[0] as any;
    if (!page?.images?.[0]?.title) return null;

    // Get the actual image URL
    const imageResponse = await fetch(
      'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        format: 'json',
        prop: 'imageinfo',
        titles: page.images[0].title,
        iiprop: 'url',
        origin: '*'
      })
    );

    const imageData = await imageResponse.json();
    const imagePages = Object.values(imageData.query.pages)[0] as any;
    return imagePages?.imageinfo?.[0]?.url;
  } catch (error) {
    console.error('Error fetching Commons image:', error);
    return null;
  }
};

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
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);

  useEffect(() => {
    if (!details?.thumbnail?.source) {
      fetchWikiCommonsImage(title).then(url => {
        if (url) setFallbackImage(url);
      });
    }
  }, [title, details?.thumbnail?.source]);

  const diff = index - currentIndex;
  const scale = 1 - Math.min(Math.abs(diff) * 0.1, 0.3);
  const translateX = diff * 100;
  const zIndex = total - Math.abs(diff);
  const opacity = 1 - Math.abs(diff) * 0.2;

  return (
    <div 
      className="absolute w-[360px]"
      style={{
        transform: `translate(calc(-50% + ${translateX}%), 0px) scale(${scale})`,
        left: '50%',
        zIndex,
        opacity,
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="backdrop-blur-xl bg-white/15 rounded-2xl overflow-hidden border border-white/30 shadow-xl" style={{ aspectRatio: '2.5/3.5' }}>
        <div className="relative h-48">
          {(details?.thumbnail?.source || fallbackImage) ? (
            <div className="relative h-full w-full">
              <Image
                src={details?.thumbnail?.source || fallbackImage || ''}
                alt={title}
                fill
                className="object-cover"
                sizes="288px"
                priority={index === currentIndex}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            </div>
          ) : (
            <div className="h-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center">
              <div className="animate-pulse text-white/60">No Image Available</div>
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-xl font-bold text-white mb-2 drop-shadow-lg line-clamp-2">
              <a
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-200 transition-colors"
              >
                {title}
              </a>
            </h3>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-b from-black/50 to-transparent h-[calc(100%-12rem)]">
          <div className="text-white/95">
            {details?.extract ? (
              <p className="text-sm leading-relaxed tracking-wide line-clamp-[12]">
                {details.extract}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="animate-pulse h-4 bg-white/20 rounded w-3/4"></div>
                <div className="animate-pulse h-4 bg-white/20 rounded w-full"></div>
                <div className="animate-pulse h-4 bg-white/20 rounded w-2/3"></div>
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

  // Move the swipeable handlers to the top level
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setCurrentCardIndex(prev => Math.min(path.length - 1, prev + 1)),
    onSwipedRight: () => setCurrentCardIndex(prev => Math.max(0, prev - 1)),
    preventScrollOnSwipe: true,
    trackMouse: true
  });

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

  const findShortestPath = async () => {
    if (loading) return;
    setLoading(true);
    setPath([]);
    setCurrentCardIndex(0);
    setArticleDetails(new Map());
    setError("");

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

  const fetchRandomArticle = async () => {
    try {
      const response = await fetch(
        'https://en.wikipedia.org/w/api.php?' +
        new URLSearchParams({
          action: 'query',
          format: 'json',
          list: 'random',
          rnnamespace: '0',
          rnlimit: '1',
          origin: '*'
        })
      );
      
      const data = await response.json();
      return data.query.random[0].title;
    } catch (error) {
      console.error('Error fetching random article:', error);
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-lg mx-auto min-h-screen flex flex-col justify-center -mt-20">
        <div className="space-y-8">
          {path.length === 0 && (
            <>
              <div className="text-center space-y-4">
                <h1 className="text-4xl font-light tracking-wide text-white">
                  Wiki Game Solver
                </h1>
                <p className="text-lg font-light text-white/80">
                  Find the shortest path between two articles
                </p>
              </div>
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  // Only submit if both fields have content
                  if (startArticle && endArticle) {
                    findShortestPath();
                  }
                }} 
                className="w-full space-y-4"
              >
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="search"
                      enterKeyHint="done"
                      value={startArticle}
                      onChange={handleStartArticleChange}
                      onFocus={() => setShowStartSuggestions(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      onBlur={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      placeholder="Start Article"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const randomArticle = await fetchRandomArticle();
                        if (randomArticle) setStartArticle(randomArticle);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white/90 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
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
                      type="search"
                      enterKeyHint="done"
                      value={endArticle}
                      onChange={handleEndArticleChange}
                      onFocus={() => setShowEndSuggestions(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      onBlur={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      placeholder="End Article"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const randomArticle = await fetchRandomArticle();
                        if (randomArticle) setEndArticle(randomArticle);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white/90 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
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
                  className="w-full px-4 py-3 bg-white/15 border-2 border-white/30 rounded-lg text-white font-medium 
                  hover:bg-white/25 hover:border-white/40 transition-all backdrop-blur-sm 
                  disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  {loading ? "Searching..." : "Find Path"}
                </button>
              </form>
            </>
          )}

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
              <h2 className="text-2xl font-light tracking-wide mb-4 text-center text-white">
                Path Found ({currentCardIndex + 1} of {path.length} steps)
              </h2>
              
              <div
                {...swipeHandlers}
                className="relative h-[500px] w-full mb-8 touch-pan-y"
              >
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

              <div className="flex flex-col items-center gap-4">
                <div className="hidden md:flex justify-center gap-4">
                  <button
                    onClick={() => setCurrentCardIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentCardIndex === 0}
                    className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors backdrop-blur-sm"
                    aria-label="Previous article"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentCardIndex(prev => Math.min(path.length - 1, prev + 1))}
                    disabled={currentCardIndex === path.length - 1}
                    className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors backdrop-blur-sm"
                    aria-label="Next article"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                <button
                  onClick={() => {
                    setPath([]);
                    setCurrentCardIndex(0);
                    setArticleDetails(new Map());
                    setStartArticle("");
                    setEndArticle("");
                  }}
                  className="px-6 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                >
                  Start New Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
