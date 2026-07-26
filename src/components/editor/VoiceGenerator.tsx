'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Filter,
  Palette,
  Gauge,
  Globe,
  ChevronDown,
  X,
  CheckCircle2,
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
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuthStore } from '@/lib/auth-store';

// ── Types ─────────────────────────────────────────────

interface Voice {
  name: string;
  description: string;
  category: string;
}

interface VoiceGeneratorProps {
  text: string;
  sceneId: string;
  narrationAudioPath?: string;
  label?: string;
  projectId?: string;
  sceneNumber?: number;
  sceneTitle?: string;
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
  projectId,
  sceneNumber,
  sceneTitle,
}: VoiceGeneratorProps) {
  // ── Pro-plan gate (client side) ──
  // Voice generation is a Pro-only feature. Free users see an upgrade
  // prompt instead of the full voice generator UI. Admins and managers
  // bypass this check (staff accounts).
  const userPlan = useAuthStore((s) => s.user?.plan);
  const userRole = useAuthStore((s) => s.user?.role);
  const isProOrStaff =
    userPlan === 'pro' || userRole === 'admin' || userRole === 'manager';

  // Voice data from API
  const [voices, setVoices] = useState<Voice[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [styles, setStyles] = useState<{ value: string; label: string }[]>([]);
  const [paces, setPaces] = useState<{ value: string; label: string }[]>([]);
  const [accents, setAccents] = useState<{ value: string; label: string }[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  // Voice selection
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Style / Pace / Accent
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedPace, setSelectedPace] = useState('');
  const [selectedAccent, setSelectedAccent] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Playback
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [hasSavedAudio, setHasSavedAudio] = useState(false);
  const [audioRecordId, setAudioRecordId] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save voice preference per browser session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('scriptforge_voice_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.voiceName) setSelectedVoiceName(parsed.voiceName);
        if (parsed.style) setSelectedStyle(parsed.style);
        if (parsed.pace) setSelectedPace(parsed.pace);
        if (parsed.accent) setSelectedAccent(parsed.accent);
        if (parsed.customInstructions) setCustomInstructions(parsed.customInstructions);
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

  const savePreference = useCallback((settings: Record<string, string>) => {
    try {
      sessionStorage.setItem('scriptforge_voice_settings', JSON.stringify(settings));
    } catch {}
  }, []);

  // Fetch voices on mount — Pro-only endpoint.
  // Skip the fetch entirely for free users to avoid a 403 round-trip
  // (the upgrade prompt is shown instead of the voice UI).
  useEffect(() => {
    if (!isProOrStaff) return;
    async function fetchVoices() {
      setVoicesLoading(true);
      try {
        const res = await fetch('/api/tts/voices');
        if (res.ok) {
          const data = await res.json();
          const voiceList: Voice[] = data.voices || [];
          setVoices(voiceList);
          setCategories(data.categories || []);
          setStyles(data.styles || []);
          setPaces(data.paces || []);
          setAccents(data.accents || []);
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
  }, [isProOrStaff]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build instructions from all dropdown selections + custom text
  const builtInstructions = useMemo(() => {
    const parts: string[] = [];
    if (selectedStyle) parts.push(selectedStyle);
    if (selectedPace === 'very_slow') parts.push('speak very slowly');
    else if (selectedPace === 'slow') parts.push('speak slowly');
    else if (selectedPace === 'moderate') parts.push('speak at a moderate pace');
    else if (selectedPace === 'fast') parts.push('speak quickly');
    else if (selectedPace === 'very_fast') parts.push('speak very quickly');
    if (selectedAccent === 'american') parts.push('with an American accent');
    else if (selectedAccent === 'british') parts.push('with a British accent');
    else if (selectedAccent === 'australian') parts.push('with an Australian accent');
    else if (selectedAccent === 'neutral') parts.push('with a neutral accent');
    if (customInstructions.trim()) parts.push(customInstructions.trim());
    return parts.join(', ');
  }, [selectedStyle, selectedPace, selectedAccent, customInstructions]);

  // Filter voices by category
  const filteredVoices = useMemo(() => {
    if (!categoryFilter || categoryFilter === 'all') return voices;
    return voices.filter(v => v.category === categoryFilter);
  }, [voices, categoryFilter]);

  // Group filtered voices by description
  const groupedVoices = useMemo(() => {
    const descriptions = [...new Set(filteredVoices.map(v => v.description))].sort();
    return descriptions.map(desc => ({
      description: desc,
      category: filteredVoices.find(v => v.description === desc)?.category || '',
      voices: filteredVoices.filter(v => v.description === desc),
    }));
  }, [filteredVoices]);

  // Active filters count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedStyle) count++;
    if (selectedPace) count++;
    if (selectedAccent) count++;
    return count;
  }, [selectedStyle, selectedPace, selectedAccent]);

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
          instructions: builtInstructions || undefined,
          saveAudio: sceneId !== 'preview',
          sceneId: sceneId !== 'preview' ? sceneId : undefined,
          projectId: sceneId !== 'preview' ? projectId : undefined,
          sceneNumber: sceneId !== 'preview' ? sceneNumber : undefined,
          sceneTitle: sceneId !== 'preview' ? sceneTitle : undefined,
          style: selectedStyle || undefined,
          pace: selectedPace || undefined,
          accent: selectedAccent || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || 'Generation failed');
      }

      const serverAudioPath = res.headers.get('X-Audio-Path');
      const serverRecordId = res.headers.get('X-Audio-Record-Id') || '';

      let url: string;
      if (serverAudioPath) {
        // Use persistent server URL so audio survives page refresh
        url = serverAudioPath;
        setHasSavedAudio(true);
        setAudioRecordId(serverRecordId);
        toast.success('Voice generated and saved to library!');
      } else {
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
  }, [selectedVoiceName, text, builtInstructions, sceneId, projectId, sceneNumber, sceneTitle, setupAudioPlayer]);

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
    // Use persistent server URL with download flag for saved audio
    if (hasSavedAudio && sceneId && sceneId !== 'preview') {
      window.open(`/api/tts/audio/${sceneId}?download=1`, '_blank');
      toast.success('Downloading audio...');
    } else {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `narration-${sceneId}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Audio downloaded');
    }
  }, [audioUrl, sceneId, hasSavedAudio]);

  // Handlers that save preferences
  const handleVoiceChange = useCallback((voiceName: string) => {
    setSelectedVoiceName(voiceName);
    savePreference({
      voiceName,
      style: selectedStyle,
      pace: selectedPace,
      accent: selectedAccent,
      customInstructions,
    });
  }, [selectedStyle, selectedPace, selectedAccent, customInstructions, savePreference]);

  const handleStyleChange = useCallback((value: string) => {
    setSelectedStyle(value);
    savePreference({
      voiceName: selectedVoiceName,
      style: value,
      pace: selectedPace,
      accent: selectedAccent,
      customInstructions,
    });
  }, [selectedVoiceName, selectedPace, selectedAccent, customInstructions, savePreference]);

  const handlePaceChange = useCallback((value: string) => {
    setSelectedPace(value);
    savePreference({
      voiceName: selectedVoiceName,
      style: selectedStyle,
      pace: value,
      accent: selectedAccent,
      customInstructions,
    });
  }, [selectedVoiceName, selectedStyle, selectedAccent, customInstructions, savePreference]);

  const handleAccentChange = useCallback((value: string) => {
    setSelectedAccent(value);
    savePreference({
      voiceName: selectedVoiceName,
      style: selectedStyle,
      pace: selectedPace,
      accent: value,
      customInstructions,
    });
  }, [selectedVoiceName, selectedStyle, selectedPace, customInstructions, savePreference]);

  const handleCustomInstructionsChange = useCallback((value: string) => {
    setCustomInstructions(value);
    savePreference({
      voiceName: selectedVoiceName,
      style: selectedStyle,
      pace: selectedPace,
      accent: selectedAccent,
      customInstructions: value,
    });
  }, [selectedVoiceName, selectedStyle, selectedPace, selectedAccent, savePreference]);

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hasAudio = !!audioUrl;
  const noText = !text.trim();

  // ── Free-plan: hide voice generation entirely ──
  // Free users see NOTHING for voice generation — no UI, no upgrade
  // prompt, no "Pro" badge. The whole component is hidden.
  // Admins/managers bypass (staff accounts).
  if (!isProOrStaff) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Voice Selection + Controls Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 shrink-0"
              disabled={voicesLoading}
            >
              <Filter className="size-3" />
              {categoryFilter === 'all' ? 'All Voices' : categoryFilter}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  categoryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                All Voices ({voices.length})
              </button>
              {categories.map(cat => {
                const count = voices.filter(v => v.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      categoryFilter === cat ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Voice Dropdown */}
        <div className="flex-1 min-w-[200px]">
          <Select value={selectedVoiceName} onValueChange={handleVoiceChange} disabled={voicesLoading}>
            <SelectTrigger className="h-8 text-xs">
              <Mic className="size-3 mr-1.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder={voicesLoading ? 'Loading voices...' : 'Select voice'} />
            </SelectTrigger>
            <SelectContent>
              {groupedVoices.map(group => (
                <React.Fragment key={group.description}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    {group.description}
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      {group.category}
                    </Badge>
                  </div>
                  {group.voices.map(voice => (
                    <SelectItem key={voice.name} value={voice.name} className="text-xs">
                      <span className="font-medium">{voice.name}</span>
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
              {filteredVoices.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  No voices in this category
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Generate Button */}
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
            <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={togglePlayback} disabled={!hasAudio}>
              {playing ? <Pause className="size-3" /> : <Play className="size-3 ml-0.5" />}
            </Button>
            <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={stopPlayback} disabled={!hasAudio}>
              <Square className="size-3" />
            </Button>
            <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={handleDownload} disabled={!hasAudio}>
              <Download className="size-3" />
            </Button>
          </div>
        )}

        {/* Saved indicator */}
        {hasSavedAudio && (
          <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-0.5 shrink-0">
            <CheckCircle2 className="size-3" /> Saved
          </span>
        )}

        {/* Settings Toggle */}
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 relative"
            >
              <Settings2 className="size-3.5 text-muted-foreground" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-3 bg-primary rounded-full flex items-center justify-center text-[8px] text-primary-foreground font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Settings2 className="size-3.5" />
                Voice Settings
              </span>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground"
                  onClick={() => {
                    setSelectedStyle('');
                    setSelectedPace('');
                    setSelectedAccent('');
                    setCustomInstructions('');
                    savePreference({ voiceName: selectedVoiceName, style: '', pace: '', accent: '', customInstructions: '' });
                  }}
                >
                  Reset All
                </Button>
              )}
            </div>

            <div className="p-3 space-y-3">
              {/* Style Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Palette className="size-3 text-purple-500" />
                  Style
                </Label>
                <Select value={selectedStyle} onValueChange={handleStyleChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.map(s => (
                      <SelectItem key={s.value || 'default'} value={s.value || 'default'}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pace Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Gauge className="size-3 text-blue-500" />
                  Pace
                </Label>
                <Select value={selectedPace} onValueChange={handlePaceChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select pace" />
                  </SelectTrigger>
                  <SelectContent>
                    {paces.map(p => (
                      <SelectItem key={p.value || 'default'} value={p.value || 'default'}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Accent Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Globe className="size-3 text-green-500" />
                  Accent
                </Label>
                <Select value={selectedAccent} onValueChange={handleAccentChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select accent" />
                  </SelectTrigger>
                  <SelectContent>
                    {accents.map(a => (
                      <SelectItem key={a.value || 'default'} value={a.value || 'default'}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Custom Instructions */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <MessageSquare className="size-3" />
                  Custom Instructions
                </Label>
                <Textarea
                  value={customInstructions}
                  onChange={e => handleCustomInstructionsChange(e.target.value)}
                  placeholder="e.g. speak with excitement, dramatic pause, emotional tone..."
                  className="min-h-[50px] text-xs resize-none"
                  rows={2}
                />
              </div>

              {/* Live instructions preview */}
              {builtInstructions && (
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Combined instructions:</p>
                  <p className="text-xs text-foreground font-mono leading-relaxed">{builtInstructions}</p>
                </div>
              )}

              {/* Model Info */}
              <div className="rounded-md border border-dashed p-2">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <Sparkles className="size-3 inline text-primary mr-0.5" />
                  Powered by Gemini 3.1 Flash TTS. 30 built-in voices with automatic language detection.
                  Style, pace, and accent are combined into natural language instructions.
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Quick-filter badges */}
      {(selectedStyle || selectedPace || selectedAccent) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedStyle && (
            <Badge variant="secondary" className="text-[10px] gap-1 pl-1.5 pr-2 py-0.5">
              <Palette className="size-2.5 text-purple-500" />
              {styles.find(s => s.value === selectedStyle)?.label || selectedStyle}
              <button onClick={() => handleStyleChange('')} className="hover:text-destructive">
                <X className="size-2.5" />
              </button>
            </Badge>
          )}
          {selectedPace && (
            <Badge variant="secondary" className="text-[10px] gap-1 pl-1.5 pr-2 py-0.5">
              <Gauge className="size-2.5 text-blue-500" />
              {paces.find(p => p.value === selectedPace)?.label || selectedPace}
              <button onClick={() => handlePaceChange('')} className="hover:text-destructive">
                <X className="size-2.5" />
              </button>
            </Badge>
          )}
          {selectedAccent && (
            <Badge variant="secondary" className="text-[10px] gap-1 pl-1.5 pr-2 py-0.5">
              <Globe className="size-2.5 text-green-500" />
              {accents.find(a => a.value === selectedAccent)?.label || selectedAccent}
              <button onClick={() => handleAccentChange('')} className="hover:text-destructive">
                <X className="size-2.5" />
              </button>
            </Badge>
          )}
        </div>
      )}

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
    </div>
  );
}
