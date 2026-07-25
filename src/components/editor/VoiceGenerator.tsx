'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Square,
  Loader2,
  Settings2,
  Mic,
  Download,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// ── Types ─────────────────────────────────────────────

interface Voice {
  name: string;
  description: string;
}

interface VoiceGeneratorProps {
  text: string;
  sceneId: string;
  narrationAudioPath?: string;
  label?: string;
}

// ── Strip stage directions client-side (for preview) ──

function stripBrackets(text: string): string {
  return text
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\*.*?\*/g, '')
    .replace(/[\[\]\(\)]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Voice Generator Component ────────────────────────

export default function VoiceGenerator({
  text,
  sceneId,
  narrationAudioPath,
  label = 'Narration',
}: VoiceGeneratorProps) {
  // Voices
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');

  // Instructions (emotion/style)
  const [instructions, setInstructions] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Playback
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [hasSavedAudio, setHasSavedAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save voice preference per browser session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('scriptforge_voice_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.voiceName) setSelectedVoiceName(parsed.voiceName);
        if (parsed.instructions) setInstructions(parsed.instructions);
      }
    } catch {}
  }, []);

  // Load saved audio on mount
  useEffect(() => {
    if (narrationAudioPath) {
      setHasSavedAudio(true);
      setAudioUrl(narrationAudioPath);
    }
  }, [narrationAudioPath]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const savePreference = useCallback((voiceName: string, instr: string) => {
    try {
      sessionStorage.setItem('scriptforge_voice_settings', JSON.stringify({
        voiceName,
        instructions: instr,
      }));
    } catch {}
  }, []);

  // Fetch voices on mount
  useEffect(() => {
    async function fetchVoices() {
      setVoicesLoading(true);
      try {
        const res = await fetch('/api/tts/voices');
        if (res.ok) {
          const data = await res.json();
          const voiceList: Voice[] = data.voices || [];
          setVoices(voiceList);
          if (!selectedVoiceName && voiceList.length > 0) {
            setSelectedVoiceName(voiceList[0].name);
          }
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error((data as Record<string, string>).error || 'Failed to load voices');
        }
      } catch {
        toast.error('Failed to connect to voice service');
      } finally {
        setVoicesLoading(false);
      }
    }
    fetchVoices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup audio player from URL
  const setupAudioPlayer = useCallback((url: string, autoPlay = false) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
      setAudioProgress(audio.currentTime / (audio.duration || 1));
    });
    audio.addEventListener('ended', () => {
      setPlaying(false);
      setAudioProgress(0);
    });
    audio.addEventListener('error', () => {
      toast.error('Audio playback error');
      setPlaying(false);
    });

    if (autoPlay) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, []);

  // Generate speech
  const handleGenerate = useCallback(async () => {
    if (!selectedVoiceName) {
      toast.error('Please select a voice first');
      return;
    }
    if (!text.trim()) {
      toast.error('No text to generate speech from');
      return;
    }

    // Check if text has anything after stripping brackets
    const cleanText = stripBrackets(text);
    if (!cleanText) {
      toast.error('No spoken text after removing stage directions');
      return;
    }

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    setAudioProgress(0);
    setAudioDuration(0);

    setGenerating(true);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: selectedVoiceName,
          text: cleanText,
          instructions: instructions || undefined,
          saveAudio: sceneId !== 'preview',
          sceneId: sceneId !== 'preview' ? sceneId : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || 'Generation failed');
      }

      // Check if server saved the audio
      const serverAudioPath = res.headers.get('X-Audio-Path');

      let url: string;
      if (serverAudioPath) {
        // Use server-saved audio URL (persistent)
        url = serverAudioPath;
        setHasSavedAudio(true);
        toast.success('Voice generated and saved!');
      } else {
        // Fallback to blob URL (not persisted — for preview only)
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        toast.success('Voice generated!');
      }

      setAudioUrl(url);
      setupAudioPlayer(url, true);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to generate voice');
    } finally {
      setGenerating(false);
    }
  }, [selectedVoiceName, text, instructions, sceneId, setupAudioPlayer]);

  // Playback controls
  const togglePlayback = useCallback(() => {
    if (!audioUrl) return;

    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        audioRef.current.play();
        setPlaying(true);
      }
    } else {
      // Re-create player for saved audio
      setupAudioPlayer(audioUrl, true);
    }
  }, [playing, audioUrl, setupAudioPlayer]);

  const stopPlayback = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlaying(false);
    setAudioProgress(0);
  }, []);

  const handleDownload = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `narration-${sceneId}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Audio downloaded');
  }, [audioUrl, sceneId]);

  // Update voice selection
  const handleVoiceChange = useCallback((voiceName: string) => {
    setSelectedVoiceName(voiceName);
    savePreference(voiceName, instructions);
  }, [instructions, savePreference]);

  const handleInstructionsChange = useCallback((value: string) => {
    setInstructions(value);
    savePreference(selectedVoiceName, value);
  }, [selectedVoiceName, savePreference]);

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Group voices by description category
  const descriptions = [...new Set(voices.map((v) => v.description))].sort();
  const groupedVoices = descriptions.map((desc) => ({
    description: desc,
    voices: voices.filter((v) => v.description === desc),
  }));

  const hasAudio = !!audioUrl;
  const noText = !text.trim();

  return (
    <div className="space-y-3">
      {/* Voice Selection + Generate Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Select value={selectedVoiceName} onValueChange={handleVoiceChange} disabled={voicesLoading}>
            <SelectTrigger className="h-8 text-xs">
              <Mic className="size-3 mr-1.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder={voicesLoading ? 'Loading voices...' : 'Select voice'} />
            </SelectTrigger>
            <SelectContent>
              {groupedVoices.map((group) => (
                <React.Fragment key={group.description}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.description}
                  </div>
                  {group.voices.map((voice) => (
                    <SelectItem key={voice.name} value={voice.name} className="text-xs">
                      <span className="font-medium">{voice.name}</span>
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating || noText || !selectedVoiceName}
          className="gap-1.5 h-8 text-xs shrink-0"
        >
          {generating ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Generating...
            </>
          ) : hasAudio ? (
            <>
              <Sparkles className="size-3" />
              Regenerate
            </>
          ) : (
            <>
              <Volume2 className="size-3" />
              Generate Voice
            </>
          )}
        </Button>

        {/* Playback Controls */}
        {hasAudio && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={togglePlayback}
              disabled={!hasAudio}
            >
              {playing ? <Pause className="size-3" /> : <Play className="size-3 ml-0.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={stopPlayback}
              disabled={!hasAudio}
            >
              <Square className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={handleDownload}
              disabled={!hasAudio}
            >
              <Download className="size-3" />
            </Button>
          </div>
        )}

        {/* Saved indicator */}
        {hasSavedAudio && (
          <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-0.5 shrink-0">
            <Volume2 className="size-3" /> Saved
          </span>
        )}

        {/* Settings Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <Settings2 className="size-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Audio Progress Bar */}
      {hasAudio && (
        <div className="space-y-1">
          <div className="relative h-1 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
              style={{ width: `${audioProgress * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          {audioDuration > 0 && (
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatTime(playing ? (audioRef.current?.currentTime || 0) : (audioProgress * audioDuration))}</span>
              <span>{formatTime(audioDuration)}</span>
            </div>
          )}
        </div>
      )}

      {/* Voice Settings Panel */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-4">
                {/* Model Info */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Sparkles className="size-3 text-primary" />
                    Gemini 3.1 Flash TTS Preview
                  </Label>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Powered by Google Gemini. 30 built-in voices with automatic language detection.
                    Add style instructions below to control emotion and tone.
                  </p>
                </div>

                <Separator />

                {/* Style Instructions */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <MessageSquare className="size-3" />
                    Style Instructions
                  </Label>
                  <Textarea
                    value={instructions}
                    onChange={(e) => handleInstructionsChange(e.target.value)}
                    placeholder="e.g. Say cheerfully, whisper softly, speak with excitement, dramatic tone..."
                    className="min-h-[60px] text-xs resize-none"
                    rows={2}
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Prepend emotion/style cues to guide the voice. Examples: &quot;Say cheerfully&quot;, 
                    &quot;whisper softly&quot;, &quot;speak with dramatic pause&quot;, &quot;excited and energetic&quot;.
                  </p>
                </div>

                {/* Reset button */}
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setInstructions('');
                      savePreference(selectedVoiceName, '');
                    }}
                  >
                    Clear Instructions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
