'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Youtube, Unplug, Loader2, Video, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';

import StatsCards from '@/components/dashboard/StatsCards';
import ChannelCard from '@/components/dashboard/ChannelCard';
import VideoCarousel from '@/components/dashboard/VideoCarousel';
import { toast } from 'sonner';
import type { YouTubeChannel, YouTubeVideo } from '@/lib/youtube';

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [ytConnected, setYtConnected] = useState(!!user?.youtubeConnected);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [channel, setChannel] = useState<YouTubeChannel | null>(null);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [channelError, setChannelError] = useState(false);

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
  const fetchYouTubeData = useCallback(async (forceRefresh = false) => {
    setLoadingChannel(true);
    setLoadingVideos(true);
    setChannelError(false);

    const channelQuery = forceRefresh ? '?refresh=true' : '';
    const videosQuery = forceRefresh ? '?refresh=true' : '';

    try {
      const channelRes = await fetch(`/api/youtube/channel${channelQuery}`);
      if (channelRes.ok) {
        const data = await channelRes.json();
        setChannel(data.channel);
        setYtConnected(true);
      } else if (channelRes.status === 404) {
        // Not connected
        setYtConnected(false);
        setChannel(null);
      } else {
        // API error (expired token, etc.) but user IS connected
        setChannelError(true);
      }
    } catch {
      setChannelError(true);
    } finally {
      setLoadingChannel(false);
    }

    try {
      const videosRes = await fetch(`/api/youtube/videos${videosQuery}`);
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

  // Handle refresh — force bypass cache
  const handleRefreshVideos = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/youtube/videos?refresh=true');
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
        toast.success('Videos refreshed');
      }
    } catch {
      toast.error('Failed to refresh videos');
    } finally {
      setRefreshing(false);
    }
  };

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
        setChannelError(false);
        setVideos([]);
        // Refresh auth store to update youtubeConnected
        const { useAuthStore } = await import('@/lib/auth-store');
        useAuthStore.getState().checkSession();
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
      ) : ytConnected && channelError ? (
        /* Connected but failed to load channel data */
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
            <div className="size-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="size-8 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Could not load channel data</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Your YouTube channel is connected but we couldn't fetch your channel info.
                Your access token may have expired — try reconnecting.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fetchYouTubeData(true)} className="gap-2">
                <RefreshCw className="size-4" />
                Retry
              </Button>
              <Button onClick={handleConnect} disabled={loadingConnect} className="gap-2">
                {loadingConnect ? <Loader2 className="size-4 animate-spin" /> : <Youtube className="size-4" />}
                Reconnect YouTube
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Not connected CTA */
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
          <VideoCarousel
            videos={videos}
            onRefresh={handleRefreshVideos}
            isRefreshing={refreshing}
          />
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Video className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No videos found on your channel yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Videos will appear once you upload them to YouTube.</p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}