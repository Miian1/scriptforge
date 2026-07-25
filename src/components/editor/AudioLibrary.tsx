'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Square,
  Download,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Mic,
  CheckCircle2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ── Types ─────────────────────────────────────────────

interface SavedAudio {
  id: string;
  sceneId: string;
  sceneNumber: number;
  sceneTitle: string;
  narration: string;
  voiceName: string;
  voiceDescription: string;
  voiceCategory: string;
  style: string;
  pace: string;
  accent: string;
  instructions: string;
  audioPath: string;
  audioSize: number;
  duration: number;
  createdAt: string;
}

interface AudioLibraryProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Format helpers ─────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// ── Audio Library Component ────────────────────────────

export default function AudioLibrary({ projectId, open, onOpenChange }: AudioLibraryProps) {
  const [audios, setAudios] = useState<SavedAudio[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch saved audios
  const fetchAudios = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tts/audios?projectId=${encodeURIComponent(projectId)}`);
      if (res.ok) {
        const data = await res.json();
        setAudios(data.audios || []);
      }
    } catch {
      toast.error('Failed to load audio library');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) {
      fetchAudios();
    }
  }, [open, projectId, fetchAudios]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Play / pause audio
  const handlePlayPause = useCallback((audio: SavedAudio) => {
    const audioUrl = `/api/tts/audio/${audio.sceneId}`;

    if (playingId === audio.id) {
      // Pause current
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
      return;
    }

    // Stop any existing playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audioEl = new Audio(audioUrl);
    audioRef.current = audioEl;

    audioEl.addEventListener('loadedmetadata', () => {
      // Duration is available
    });
    audioEl.addEventListener('timeupdate', () => {
      const pct = audioEl.currentTime / (audioEl.duration || 1);
      setProgress(prev => ({ ...prev, [audio.id]: pct }));
    });
    audioEl.addEventListener('ended', () => {
      setPlayingId(null);
      setProgress(prev => ({ ...prev, [audio.id]: 0 }));
    });
    audioEl.addEventListener('error', () => {
      toast.error('Failed to play audio');
      setPlayingId(null);
    });

    audioEl.play().then(() => setPlayingId(audio.id)).catch(() => {
      toast.error('Playback failed');
    });
  }, [playingId]);

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingId(null);
    setProgress({});
  }, []);

  // Download
  const handleDownload = useCallback((audio: SavedAudio) => {
    window.open(`/api/tts/audio/${audio.sceneId}?download=1`, '_blank');
    toast.success('Downloading...');
  }, []);

  // Delete
  const handleDelete = useCallback(async (audio: SavedAudio) => {
    try {
      const res = await fetch(`/api/tts/audios/${audio.id}`, { method: 'DELETE' });
      if (res.ok) {
        setAudios(prev => prev.filter(a => a.id !== audio.id));
        if (playingId === audio.id) handleStop();
        toast.success('Audio deleted');
        // Also remove from scene's narrationAudioPath in the store
        // by re-fetching scenes
        window.dispatchEvent(new CustomEvent('audio-deleted', { detail: { sceneId: audio.sceneId } }));
      } else {
        toast.error('Failed to delete audio');
      }
    } catch {
      toast.error('Failed to delete audio');
    }
  }, [playingId, handleStop]);

  const totalSize = audios.reduce((sum, a) => sum + a.audioSize, 0);
  const totalDuration = audios.reduce((sum, a) => sum + a.duration, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Volume2 className="size-5 text-primary" />
            Audio Library
          </DialogTitle>
          <div className="flex items-center gap-3 mt-1">
            {audios.length > 0 && (
              <>
                <Badge variant="secondary" className="text-xs">
                  {audios.length} audio{audios.length !== 1 ? 's' : ''}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(totalDuration)} total
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(totalSize)}
                </span>
              </>
            )}
          </div>
        </DialogHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading audio library...</span>
            </div>
          ) : audios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Volume2 className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No audio generated yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Generate voice for scenes using the voice controls on each scene card.
                Saved audio will appear here for easy access and download.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {audios.map(audio => (
                <AudioItem
                  key={audio.id}
                  audio={audio}
                  isPlaying={playingId === audio.id}
                  progress={progress[audio.id] || 0}
                  expanded={expandedId === audio.id}
                  onToggleExpand={() => setExpandedId(expandedId === audio.id ? null : audio.id)}
                  onPlayPause={() => handlePlayPause(audio)}
                  onStop={handleStop}
                  onDownload={() => handleDownload(audio)}
                  onDelete={() => handleDelete(audio)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Audio Item ────────────────────────────────────────

interface AudioItemProps {
  audio: SavedAudio;
  isPlaying: boolean;
  progress: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onPlayPause: () => void;
  onStop: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

function AudioItem({
  audio,
  isPlaying,
  progress,
  expanded,
  onToggleExpand,
  onPlayPause,
  onStop,
  onDownload,
  onDelete,
}: AudioItemProps) {
  return (
    <Card className="border overflow-hidden">
      <CardContent className="p-0">
        {/* Main row */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Play/Pause button */}
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="size-3" /> : <Play className="size-3 ml-0.5" />}
          </Button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium truncate">
                Scene {audio.sceneNumber}: {audio.sceneTitle}
              </span>
              <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Mic className="size-2.5" />
                {audio.voiceName}
              </span>
              <span className="flex items-center gap-0.5">
                <Clock className="size-2.5" />
                {formatDuration(audio.duration)}
              </span>
              <span>{formatFileSize(audio.audioSize)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-16 h-1 rounded-full bg-muted overflow-hidden shrink-0">
            <div
              className="h-full bg-primary rounded-full transition-all duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onDownload}
              title="Download"
            >
              <Download className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onToggleExpand}
              title="Details"
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Separator />
              <div className="px-3 py-2.5 space-y-2 bg-muted/20">
                {/* Voice settings used */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {audio.voiceDescription} {audio.voiceCategory}
                  </Badge>
                  {audio.style && (
                    <Badge variant="outline" className="text-[10px]">Style: {audio.style}</Badge>
                  )}
                  {audio.pace && (
                    <Badge variant="outline" className="text-[10px]">Pace: {audio.pace}</Badge>
                  )}
                  {audio.accent && (
                    <Badge variant="outline" className="text-[10px]">Accent: {audio.accent}</Badge>
                  )}
                </div>

                {/* Narration preview */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {audio.narration || 'No narration text'}
                </p>

                {/* Meta */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Generated: {formatDate(audio.createdAt)}</span>
                  <span className="font-mono">{audio.audioPath}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
