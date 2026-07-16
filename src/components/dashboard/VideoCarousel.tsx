'use client';

import { Eye, ThumbsUp, MessageCircle, ExternalLink, Clock, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

export default function VideoCarousel({ videos }: { videos: YouTubeVideo[] }) {
  if (videos.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Videos
        </h3>
        <span className="text-xs text-muted-foreground">
          {videos.length} video{videos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Video List */}
      <div className="space-y-2">
        {videos.map((video) => (
          <a
            key={video.id}
            href={`https://youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <Card className="transition-all hover:shadow-md hover:border-primary/30 bg-card">
              <CardContent className="p-3 sm:p-4">
                <div className="flex gap-3 sm:gap-4">
                  {/* Thumbnail */}
                  <div className="relative shrink-0 w-36 sm:w-44 md:w-52 aspect-video rounded-md overflow-hidden bg-muted">
                    {video.thumbnail ? (
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="size-6 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                      <div className="size-10 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="size-5 text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <h4 className="text-sm sm:text-base font-medium line-clamp-2 leading-snug group-hover:text-primary transition-colors">
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

                    {/* External link hint */}
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/60 group-hover:text-primary/60 transition-colors">
                      <ExternalLink className="size-3" />
                      <span>Watch on YouTube</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}