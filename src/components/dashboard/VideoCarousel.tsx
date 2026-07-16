'use client';

import { motion } from 'framer-motion';
import { Eye, ThumbsUp, MessageCircle, ExternalLink, Play } from 'lucide-react';
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
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

export default function VideoCarousel({ videos }: { videos: YouTubeVideo[] }) {
  if (videos.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Videos
        </h3>
        <span className="text-xs text-muted-foreground">{videos.length} videos</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
        {videos.map((video, index) => (
          <motion.div
            key={video.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="snap-start"
          >
            <a
              href={`https://youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <Card className="w-[280px] sm:w-[300px] h-full transition-shadow hover:shadow-md">
                <CardContent className="p-0">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
                    {video.thumbnail ? (
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center">
                        <Play className="size-8 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                      <Play className="size-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <h4 className="text-sm font-medium line-clamp-2 leading-snug min-h-[2.5rem]">
                      {video.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(video.publishedAt)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" />
                        {formatCount(video.views)}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="size-3" />
                        {formatCount(video.likes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="size-3" />
                        {formatCount(video.comments)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </a>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}