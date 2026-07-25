'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Mic,
  Download,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

// ── Types ─────────────────────────────────────────────

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

interface VoiceSettingsState {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
}

interface VoiceGeneratorProps {
  text: string;
  sceneId: string;
  label?: string;
}

interface SettingSliderProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

// ── Setting Slider ────────────────────────────────────

function SettingSlider({ label, description, value, min, max, step, onChange }: SettingSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
          {value.toFixed(2)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      <p className="text-[10px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// ── Voice Generator Component ────────────────────────

export default function VoiceGenerator({ text, sceneId, label = 'Narration' }: VoiceGeneratorProps) {
  // Voices
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('eleven_multilingual_v2');

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<VoiceSettingsState>({
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    speed: 1.0,
  });

  // Playback
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save voice preference per browser session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('scriptforge_voice_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.voiceId) setSelectedVoiceId(parsed.voiceId);
        if (parsed.modelId) setSelectedModelId(parsed.modelId);
        if (parsed.settings) setSettings(parsed.settings);
      }
    } catch {}
  }, []);

  const savePreference = useCallback((voiceId: string, modelId: string, s: VoiceSettingsState) => {
    try {
      sessionStorage.setItem('scriptforge_voice_settings', JSON.stringify({
        voiceId,
        modelId,
        settings: s,
      }));
    } catch {}
  }, []);

  // Fetch voices on mount
  useEffect(() => {
    async function fetchVoices() {
      setVoicesLoading(true);
      try {
        const res = await fetch('/api/elevenlabs/voices');
        if (res.ok) {
          const data = await res.json();
          const voiceList: Voice[] = data.voices || [];
          setVoices(voiceList);
          // Auto-select first voice if none selected
          if (!selectedVoiceId && voiceList.length > 0) {
            setSelectedVoiceId(voiceList[0].voice_id);
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

  // Generate speech
  const handleGenerate = useCallback(async () => {
    if (!selectedVoiceId) {
      toast.error('Please select a voice first');
      return;
    }
    if (!text.trim()) {
      toast.error('No text to generate speech from');
      return;
    }

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setPlaying(false);
    setAudioProgress(0);
    setAudioDuration(0);

    setGenerating(true);
    try {
      const res = await fetch('/api/elevenlabs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: selectedVoiceId,
          text: text.trim(),
          settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity_boost,
            style: settings.style,
            speed: settings.speed,
            use_speaker_boost: true,
          },
          modelId: selectedModelId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || 'Generation failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // Auto-play
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

      await audio.play();
      setPlaying(true);
      toast.success('Voice generated successfully!');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to generate voice');
    } finally {
      setGenerating(false);
    }
  }, [selectedVoiceId, text, settings, selectedModelId]);

  // Playback controls
  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }, [playing]);

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
    a.download = `narration-${sceneId}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Audio downloaded');
  }, [audioUrl, sceneId]);

  // Preview voice
  const handlePreviewVoice = useCallback((voice: Voice) => {
    if (!voice.preview_url) return;
    const preview = new Audio(voice.preview_url);
    preview.play().catch(() => {});
  }, []);

  // Update voice selection
  const handleVoiceChange = useCallback((voiceId: string) => {
    setSelectedVoiceId(voiceId);
    savePreference(voiceId, selectedModelId, settings);
  }, [selectedModelId, settings, savePreference]);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    savePreference(selectedVoiceId, modelId, settings);
  }, [selectedVoiceId, settings, savePreference]);

  const handleSettingsChange = useCallback(<K extends keyof VoiceSettingsState>(key: K, value: number) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      savePreference(selectedVoiceId, selectedModelId, updated);
      return updated;
    });
  }, [selectedVoiceId, selectedModelId, savePreference]);

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Group voices by category
  const categories = [...new Set(voices.map((v) => v.category || 'Other'))].sort();
  const groupedVoices = categories.map((cat) => ({
    category: cat,
    voices: voices.filter((v) => (v.category || 'Other') === cat),
  }));

  const hasAudio = !!audioUrl;
  const noText = !text.trim();

  return (
    <div className="space-y-3">
      {/* Voice Selection + Generate Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Select value={selectedVoiceId} onValueChange={handleVoiceChange} disabled={voicesLoading}>
            <SelectTrigger className="h-8 text-xs">
              <Mic className="size-3 mr-1.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder={voicesLoading ? 'Loading voices...' : 'Select voice'} />
            </SelectTrigger>
            <SelectContent>
              {groupedVoices.map((group) => (
                <React.Fragment key={group.category}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.category}
                  </div>
                  {group.voices.map((voice) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{voice.name}</span>
                        {voice.labels && (
                          <span className="text-muted-foreground text-[10px]">
                            {voice.labels.accent && `${voice.labels.accent}`}
                            {voice.labels.gender && ` · ${voice.labels.gender}`}
                          </span>
                        )}
                      </div>
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
          disabled={generating || noText || !selectedVoiceId}
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
                {/* Model Selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">TTS Model</Label>
                  <Select value={selectedModelId} onValueChange={handleModelChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { id: 'eleven_multilingual_v2', name: 'Multilingual v2', desc: 'Best quality' },
                        { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', desc: 'Low latency' },
                        { id: 'eleven_turbo_v2', name: 'Turbo v2', desc: 'Fast generation' },
                        { id: 'eleven_monolingual_v1', name: 'English v1', desc: 'English only' },
                      ].map((model) => (
                        <SelectItem key={model.id} value={model.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-muted-foreground text-[10px]">{model.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Voice Settings Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SettingSlider
                    label="Stability"
                    description="Higher = more consistent but less expressive"
                    value={settings.stability}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => handleSettingsChange('stability', v)}
                  />
                  <SettingSlider
                    label="Similarity"
                    description="Higher = closer to the original voice"
                    value={settings.similarity_boost}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => handleSettingsChange('similarity_boost', v)}
                  />
                  <SettingSlider
                    label="Style"
                    description="Higher = more stylized and expressive"
                    value={settings.style}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => handleSettingsChange('style', v)}
                  />
                  <SettingSlider
                    label="Speed"
                    description="Controls speaking speed (0.25x - 4.0x)"
                    value={settings.speed}
                    min={0.25}
                    max={4.0}
                    step={0.05}
                    onChange={(v) => handleSettingsChange('speed', v)}
                  />
                </div>

                {/* Reset button */}
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const defaults = { stability: 0.5, similarity_boost: 0.75, style: 0.0, speed: 1.0 };
                      setSettings(defaults);
                      savePreference(selectedVoiceId, selectedModelId, defaults);
                    }}
                  >
                    Reset to Defaults
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
