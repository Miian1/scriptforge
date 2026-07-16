'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  ThumbsUp,
  MessageCircle,
  Clock,
  Tag,
  Loader2,
  Sparkles,
  Send,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { YouTubeVideoDetails, YouTubeComment } from '@/lib/youtube';

function formatCount(n: number): string {
  if (n == null || isNaN(n)) return '0';
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

function parseDuration(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || '0');
  const min = parseInt(m[2] || '0');
  const s = parseInt(m[3] || '0');
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
}

export default function VideoDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;

  const [video, setVideo] = useState<YouTubeVideoDetails | null>(null);
  const [comments, setComments] = useState<YouTubeComment[]>([]);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);

  // AI states
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingResult, setReplyingResult] = useState<Record<string, string>>({});
  const [improving, setImproving] = useState<'description' | 'tags' | 'both' | null>(null);
  const [improvedDesc, setImprovedDesc] = useState('');
  const [improvedTags, setImprovedTags] = useState('');
  const [applyingDesc, setApplyingDesc] = useState(false);
  const [applyingTags, setApplyingTags] = useState(false);
  const [showImprovePanel, setShowImprovePanel] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState('');

  // Fetch video details
  const fetchVideo = useCallback(async () => {
    setLoadingVideo(true);
    try {
      const res = await fetch(`/api/youtube/video/${videoId}`);
      if (res.ok) {
        const data = await res.json();
        setVideo(data.video);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to load video');
      }
    } catch {
      toast.error('Failed to load video');
    } finally {
      setLoadingVideo(false);
    }
  }, [videoId]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/youtube/video/${videoId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {
      // Comments may be disabled
    } finally {
      setLoadingComments(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchVideo();
    fetchComments();
  }, [fetchVideo, fetchComments]);

  // AI Reply
  const handleAIReply = async (commentId: string, commentText: string) => {
    setReplyingTo(commentId);
    setReplyingResult((prev) => ({ ...prev, [commentId]: '' }));
    try {
      const res = await fetch(`/api/youtube/video/${videoId}/ai-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, commentText }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyingResult((prev) => ({ ...prev, [commentId]: data.reply }));
        if (data.posted) {
          toast.success('Reply posted to YouTube!');
          fetchComments(); // refresh
        } else {
          toast.warning('Reply generated but could not be posted. Copy it manually.');
        }
      } else {
        toast.error(data.error || 'Failed to generate reply');
      }
    } catch {
      toast.error('Failed to generate AI reply');
    } finally {
      setReplyingTo(null);
    }
  };

  // Improve metadata
  const handleImprove = async (type: 'description' | 'tags' | 'both') => {
    setImproving(type);
    setImprovedDesc('');
    setImprovedTags('');
    try {
      const res = await fetch(`/api/youtube/video/${videoId}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.description) setImprovedDesc(data.description);
        if (data.tags) setImprovedTags(Array.isArray(data.tags) ? data.tags.join(', ') : '');
        setShowImprovePanel(true);
        toast.success('AI suggestions generated!');
      } else {
        toast.error(data.error || 'Failed to improve');
      }
    } catch {
      toast.error('Failed to improve metadata');
    } finally {
      setImproving(null);
    }
  };

  // Apply improved description to YouTube
  const handleApplyDesc = async () => {
    if (!improvedDesc) return;
    setApplyingDesc(true);
    try {
      const res = await fetch(`/api/youtube/video/${videoId}/improve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: improvedDesc }),
      });
      if (res.ok) {
        toast.success('Description updated on YouTube!');
        fetchVideo(); // refresh
      } else {
        const data = await res.json().catch(() => ({}));
        const errMsg = data.error || 'Failed to update description';
        if (errMsg.includes('permission') || errMsg.includes('reconnect')) {
          toast.error(errMsg + ' Go to Settings to reconnect your YouTube account.', { duration: 6000 });
        } else {
          toast.error(errMsg);
        }
      }
    } catch {
      toast.error('Failed to update description');
    } finally {
      setApplyingDesc(false);
    }
  };

  // Apply improved tags to YouTube
  const handleApplyTags = async () => {
    if (!improvedTags) return;
    setApplyingTags(true);
    try {
      const tags = improvedTags.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`/api/youtube/video/${videoId}/improve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      if (res.ok) {
        toast.success('Tags updated on YouTube!');
        fetchVideo();
      } else {
        const data = await res.json().catch(() => ({}));
        const errMsg = data.error || 'Failed to update tags';
        if (errMsg.includes('permission') || errMsg.includes('reconnect')) {
          toast.error(errMsg + ' Go to Settings to reconnect your YouTube account.', { duration: 6000 });
        } else {
          toast.error(errMsg);
        }
      }
    } catch {
      toast.error('Failed to update tags');
    } finally {
      setApplyingTags(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  if (loadingVideo) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Video not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard')} className="mt-4">
          <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="shrink-0">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Video Details</h1>
          <p className="text-sm text-muted-foreground truncate">{video.title}</p>
        </div>
      </div>

      {/* Video Info Card */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Thumbnail */}
            <div className="relative shrink-0 w-full lg:w-[480px] aspect-video rounded-t-lg lg:rounded-l-lg lg:rounded-tr-none overflow-hidden bg-muted">
              {video.thumbnail && (
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
              )}
            </div>

            {/* Details */}
            <div className="flex-1 p-4 sm:p-5 space-y-4 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold leading-snug">{video.title}</h2>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Eye className="size-4" />
                  <span className="font-medium text-foreground">{formatCount(video.views ?? 0)}</span> views
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ThumbsUp className="size-4" />
                  <span className="font-medium text-foreground">{formatCount(video.likes ?? 0)}</span> likes
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageCircle className="size-4" />
                  <span className="font-medium text-foreground">{formatCount(video.comments ?? 0)}</span> comments
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-4" />
                  {timeAgo(video.publishedAt)}
                </span>
                {video.duration && (
                  <span className="text-muted-foreground">
                    {parseDuration(video.duration)}
                  </span>
                )}
              </div>

              {/* Tags */}
              {video.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {video.tags.slice(0, 10).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                      <Tag className="size-3 mr-1" />{tag}
                    </Badge>
                  ))}
                  {video.tags.length > 10 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      +{video.tags.length - 10} more
                    </Badge>
                  )}
                </div>
              )}

              {/* Description */}
              {video.description && (
                <div>
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
                  >
                    Description
                    {descExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                  <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${!descExpanded ? 'line-clamp-3' : ''}`}>
                    {video.description}
                  </p>
                </div>
              )}

              {/* AI Improve Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImprove('description')}
                  disabled={!!improving}
                  className="gap-1.5"
                >
                  {improving === 'description' || improving === 'both' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Improve Description
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImprove('tags')}
                  disabled={!!improving}
                  className="gap-1.5"
                >
                  {improving === 'tags' || improving === 'both' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Improve Tags
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImprove('both')}
                  disabled={!!improving}
                  className="gap-1.5"
                >
                  {improving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Improve Both
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Improvement Panel */}
      {showImprovePanel && (improvedDesc || improvedTags) && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                AI Suggestions
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowImprovePanel(false)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {improvedDesc && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Improved Description</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(improvedDesc, 'desc')}
                    className="h-7 px-2 text-xs"
                  >
                    {copied === 'desc' ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copied === 'desc' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <Textarea
                  value={improvedDesc}
                  onChange={(e) => setImprovedDesc(e.target.value)}
                  rows={6}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleApplyDesc}
                  disabled={applyingDesc}
                  className="gap-1.5"
                >
                  {applyingDesc ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Apply to YouTube
                </Button>
              </div>
            )}
            {improvedTags && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Improved Tags</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(improvedTags, 'tags')}
                    className="h-7 px-2 text-xs"
                  >
                    {copied === 'tags' ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copied === 'tags' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <Textarea
                  value={improvedTags}
                  onChange={(e) => setImprovedTags(e.target.value)}
                  rows={3}
                  className="text-sm"
                  placeholder="tag1, tag2, tag3"
                />
                <Button
                  size="sm"
                  onClick={handleApplyTags}
                  disabled={applyingTags}
                  className="gap-1.5"
                >
                  {applyingTags ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Apply to YouTube
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comments Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageCircle className="size-4" />
              Comments
              {!loadingComments && <span className="text-muted-foreground font-normal">({comments.length})</span>}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchComments} className="h-7 px-2 text-xs">
              <RefreshCw className="size-3 mr-1" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingComments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No comments on this video yet.</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  {/* Avatar */}
                  <div className="shrink-0 w-9 h-9 rounded-full bg-muted overflow-hidden">
                    {comment.authorAvatar ? (
                      <img src={comment.authorAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {comment.authorName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Comment body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{comment.authorName}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(comment.publishedAt)}</span>
                      {comment.likeCount > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <ThumbsUp className="size-3" /> {comment.likeCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{comment.text}</p>

                    {/* AI Reply area */}
                    <div className="mt-2 space-y-2">
                      {replyingResult[comment.id] && (
                        <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="size-3 text-primary" />
                            <span className="text-xs font-medium text-primary">AI Reply</span>
                          </div>
                          <p className="text-sm">{replyingResult[comment.id]}</p>
                          <button
                            onClick={() => copyToClipboard(replyingResult[comment.id], `reply-${comment.id}`)}
                            className="text-xs text-muted-foreground hover:text-foreground mt-1.5 flex items-center gap-1"
                          >
                            {copied === `reply-${comment.id}` ? <Check className="size-3" /> : <Copy className="size-3" />}
                            {copied === `reply-${comment.id}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAIReply(comment.id, comment.text)}
                        disabled={replyingTo === comment.id}
                        className="h-7 px-2 text-xs gap-1.5 text-primary hover:text-primary"
                      >
                        {replyingTo === comment.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Send className="size-3" />
                        )}
                        AI Reply
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}