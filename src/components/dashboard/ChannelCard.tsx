'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Video, Eye, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [descExpanded, setDescExpanded] = useState(false);
  const hasDesc = !!channel.description;
  const isLongDesc = hasDesc && channel.description!.length > 120;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card>
        <CardContent className="p-5 space-y-4">
          {/* Avatar + Title Row */}
          <div className="flex items-center gap-4">
            <div className="size-14 shrink-0 rounded-full border-2 border-muted shadow-sm overflow-hidden bg-muted">
              {channel.thumbnail ? (
                <img
                  src={channel.thumbnail}
                  alt={channel.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="size-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                  {channel.title?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold truncate">{channel.title}</h2>
              <a
                href={`https://youtube.com/channel/${channel.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors mt-1"
              >
                <ExternalLink className="size-3" />
                View Channel
              </a>
            </div>
          </div>

          {/* Channel Description */}
          {hasDesc && (
            <div>
              <AnimatePresence mode="wait">
                <p
                  className={cn(
                    'text-sm text-muted-foreground leading-relaxed transition-all duration-300',
                    !descExpanded && 'line-clamp-2'
                  )}
                >
                  {channel.description}
                </p>
              </AnimatePresence>
              {isLongDesc && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mt-1.5"
                >
                  {descExpanded ? (
                    <>
                      Show less
                      <ChevronUp className="size-3.5" />
                    </>
                  ) : (
                    <>
                      See all
                      <ChevronDown className="size-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Stats Row */}
          <div className="flex items-center gap-5">
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
