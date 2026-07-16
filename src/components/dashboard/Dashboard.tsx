'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Youtube, Unplug, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/store';
import { PLAN_LIMITS } from '@/lib/usage';
import StatsCards from '@/components/dashboard/StatsCards';
import ChannelCard from '@/components/dashboard/ChannelCard';
import VideoCarousel from '@/components/dashboard/VideoCarousel';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { YouTubeChannel, YouTubeVideo } from '@/lib/youtube';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [ytConnected, setYtConnected] = useState(false);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [channel, setChannel] = useState<YouTubeChannel | null>(null);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Check YouTube connection status from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('youtube') === 'connected') {
      toast.success('YouTube channel connected!');
      setYtConnected(true);
      window.history.replaceState({}, '', '/dashboard');
    }
    if (params.get('youtube') === 'error') {
      toast.error('Failed to connect YouTube. Please try again.');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  // Fetch YouTube data if connected
  const fetchYouTubeData = useCallback(async () => {
    setLoadingChannel(true);
    setLoadingVideos(true);

    try {
      const channelRes = await fetch('/api/youtube/channel');
      if (channelRes.ok) {
        const data = await channelRes.json();
        setChannel(data.channel);
        setYtConnected(true);
      }
    } catch {
      // Not connected
    } finally {
      setLoadingChannel(false);
    }

    try {
      const videosRes = await fetch('/api/youtube/videos');
      if (videosRes.ok) {
        const data = await videosRes.json();
        setVideos(data.videos || []);
      }
    } catch {
      // Not connected
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    fetchYouTubeData();
  }, [fetchYouTubeData]);

  // Connect YouTube
  const handleConnect = () => {
    setLoadingConnect(true);
    window.location.href = '/api/youtube/auth';
  };

  // Disconnect YouTube
  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/youtube/disconnect', { method: 'POST' });
      if (res.ok) {
        setYtConnected(false);
        setChannel(null);
        setVideos([]);
        toast.success('YouTube channel disconnected');
      }
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ytConnected ? 'Your YouTube channel overview' : 'Connect your YouTube channel to get started'}
          </p>
        </div>
        {ytConnected ? (
          <Button
            variant="outline"
            onClick={handleDisconnect}
            className="shrink-0 gap-2 text-destructive hover:text-destructive"
          >
            <Unplug className="size-4" />
            Disconnect Channel
          </Button>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={loadingConnect}
            className="shrink-0 gap-2"
          >
            {loadingConnect ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Youtube className="size-4" />
            )}
            Connect YouTube Channel
          </Button>
        )}
      </div>

      {/* YouTube Channel Card */}
      {loadingChannel ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : ytConnected && channel ? (
        <ChannelCard channel={channel} />
      ) : (
        /* Not connected CTA */
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
              <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <Youtube className="size-8 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Connect Your YouTube Channel</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Link your YouTube account to see your channel stats, recent videos, and
                  manage everything in one place.
                </p>
              </div>
              <Button onClick={handleConnect} disabled={loadingConnect} className="gap-2">
                {loadingConnect ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Youtube className="size-4" />
                )}
                Connect with Google
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Usage Stats */}
      <StatsCards />

      {/* Recent Videos */}
      {ytConnected && (
        loadingVideos ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : videos.length > 0 ? (
          <VideoCarousel videos={videos} />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="size-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No videos found on your channel yet.</p>
              </CardContent>
            </Card>
          </motion.div>
        )
      )}
    </div>
  );
}