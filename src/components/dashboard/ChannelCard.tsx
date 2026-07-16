'use client';

import { motion } from 'framer-motion';
import { Users, Video, Eye, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { YouTubeChannel } from '@/lib/youtube';
import { cn } from '@/lib/utils';

function formatCount(n: number): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function ChannelCard({ channel }: { channel: YouTubeChannel }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Banner */}
          <div className="h-36 sm:h-44 relative bg-muted">
            {channel.bannerUrl ? (
              <img
                src={channel.bannerUrl}
                alt=""
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-red-500 via-red-600 to-rose-500" />
            )}
            {/* Avatar */}
            <div className="absolute -bottom-8 left-5">
              <div className="size-16 rounded-full border-4 border-background shadow-lg overflow-hidden bg-muted">
                {channel.thumbnail ? (
                  <img
                    src={channel.thumbnail}
                    alt={channel.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                    {channel.title?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="pt-10 px-5 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{channel.title}</h2>
                {channel.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {channel.description}
                  </p>
                )}
              </div>
              <a
                href={`https://youtube.com/channel/${channel.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <div className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors'
                )}>
                  <ExternalLink className="size-3" />
                  View Channel
                </div>
              </a>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-5 mt-4">
              <div className="flex items-center gap-1.5 text-sm">
                <Users className="size-4 text-muted-foreground" />
                <span className="font-semibold">{formatCount(channel.subscriberCount ?? 0)}</span>
                <span className="text-muted-foreground text-xs">subscribers</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Video className="size-4 text-muted-foreground" />
                <span className="font-semibold">{formatCount(channel.videoCount ?? 0)}</span>
                <span className="text-muted-foreground text-xs">videos</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Eye className="size-4 text-muted-foreground" />
                <span className="font-semibold">{formatCount(channel.viewCount ?? 0)}</span>
                <span className="text-muted-foreground text-xs">total views</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}