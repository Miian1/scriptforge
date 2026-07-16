'use client';

import { useState, useMemo } from 'react';
import { Eye, ThumbsUp, MessageCircle, Clock, Play, Search, ArrowUpDown, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import type { YouTubeVideo } from '@/lib/youtube';

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return 'yesterday';
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months ago`;
  return `${Math.floor(seconds / 31536000)} years ago`;
}

type SortOption = 'newest' | 'oldest' | 'most_views' | 'most_likes' | 'most_comments';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most_views', label: 'Most Views' },
  { value: 'most_likes', label: 'Most Likes' },
  { value: 'most_comments', label: 'Most Comments' },
];

interface VideoCarouselProps {
  videos: YouTubeVideo[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function VideoCarousel({ videos, onRefresh, isRefreshing }: VideoCarouselProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const filteredAndSorted = useMemo(() => {
    let result = [...videos];

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((v) => v.title.toLowerCase().includes(q));
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
        break;
      case 'most_views':
        result.sort((a, b) => b.views - a.views);
        break;
      case 'most_likes':
        result.sort((a, b) => b.likes - a.likes);
        break;
      case 'most_comments':
        result.sort((a, b) => b.comments - a.comments);
        break;
    }

    return result;
  }, [videos, searchQuery, sortBy]);

  if (videos.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Videos
        </h3>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`size-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {filteredAndSorted.length} of {videos.length} video{videos.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm bg-background"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-8 pl-8 pr-8 text-sm rounded-md border border-input bg-background text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Video List */}
      <div className="space-y-2">
        {filteredAndSorted.length > 0 ? (
          filteredAndSorted.map((video) => (
            <div key={video.id} className="group">
              <Card className="transition-all hover:shadow-md hover:border-primary/30 bg-card">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex gap-3 sm:gap-4">
                    {/* Thumbnail */}
                    <div className="relative shrink-0 w-36 sm:w-44 md:w-52 aspect-video rounded-md overflow-hidden bg-muted">
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="size-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <h4 className="text-sm sm:text-base font-medium line-clamp-2 leading-snug">
                        {video.title}
                      </h4>

                      {/* Time ago */}
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span>{timeAgo(video.publishedAt)}</span>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Eye className="size-3.5" />
                          <span className="font-medium text-foreground">{formatCount(video.views)}</span>
                          <span>views</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ThumbsUp className="size-3.5" />
                          <span className="font-medium text-foreground">{formatCount(video.likes)}</span>
                          <span>likes</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageCircle className="size-3.5" />
                          <span className="font-medium text-foreground">{formatCount(video.comments)}</span>
                          <span>comments</span>
                        </span>
                      </div>

                      {/* See Details button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); router.push(`/video/${video.id}`); }}
                        className="mt-2.5 h-7 text-xs gap-1.5"
                      >
                        <ExternalLink className="size-3" />
                        See Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="size-6 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                No videos match &quot;{searchQuery}&quot;
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-primary mt-1 hover:underline"
              >
                Clear search
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}