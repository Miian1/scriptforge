'use client';

import React from 'react';
import {
  Clapperboard,
  BookOpen,
  Users,
  Clock,
  Globe,
  Palette,
  PenTool,
  Target,
  Film,
  ListChecks,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Project } from '@/lib/types';
import {
  THEME_LABELS,
  STYLE_LABELS,
  AUDIENCE_LABELS,
  LANGUAGE_LABELS,
  DURATION_LABELS,
} from '@/lib/types';

interface VideoConceptCardProps {
  project: Project;
}

export default function VideoConceptCard({ project }: VideoConceptCardProps) {
  const { title, topic, description, settings } = project;

  // Build a concise concept paragraph from project data
  const conceptLines: string[] = [];
  if (title) conceptLines.push(`This script is for "${title}",`);
  if (topic) conceptLines.push(`focused on the topic of ${topic}.`);
  if (description) {
    conceptLines.push(
      `The video explores ${description.length > 120 ? description.slice(0, 120) + '...' : description}.`
    );
  }
  if (settings.targetAudience) {
    conceptLines.push(
      `It is tailored for ${AUDIENCE_LABELS[settings.targetAudience]?.toLowerCase() || settings.targetAudience} audiences.`
    );
  }

  // Build main topic bullets from scenes & project metadata
  const topicBullets: { icon: React.ReactNode; text: string }[] = [];

  if (topic) {
    topicBullets.push({
      icon: <Target className="size-3.5 text-primary" />,
      text: `Core Topic: ${topic}`,
    });
  }

  if (settings.writingStyle) {
    topicBullets.push({
      icon: <PenTool className="size-3.5 text-primary" />,
      text: `Writing Style: ${STYLE_LABELS[settings.writingStyle] || settings.writingStyle}`,
    });
  }

  if (settings.theme) {
    topicBullets.push({
      icon: <Palette className="size-3.5 text-primary" />,
      text: `Visual Theme: ${THEME_LABELS[settings.theme] || settings.theme}`,
    });
  }

  if (settings.language) {
    topicBullets.push({
      icon: <Globe className="size-3.5 text-primary" />,
      text: `Language: ${LANGUAGE_LABELS[settings.language] || settings.language}`,
    });
  }

  if (settings.duration) {
    topicBullets.push({
      icon: <Clock className="size-3.5 text-primary" />,
      text: `Duration Target: ${DURATION_LABELS[settings.duration] || settings.duration}`,
    });
  }

  if (settings.totalScenes) {
    topicBullets.push({
      icon: <Film className="size-3.5 text-primary" />,
      text: `Total Scenes: ${settings.totalScenes} scenes across ${Math.ceil(settings.totalScenes / (settings.scenesPerPhase || 10))} phases`,
    });
  }

  if (settings.targetAudience) {
    topicBullets.push({
      icon: <Users className="size-3.5 text-primary" />,
      text: `Target Audience: ${AUDIENCE_LABELS[settings.targetAudience] || settings.targetAudience}`,
    });
  }

  if (settings.sceneLength) {
    topicBullets.push({
      icon: <BookOpen className="size-3.5 text-primary" />,
      text: `Average Scene Length: ~${settings.sceneLength}s per scene`,
    });
  }

  return (
    <Card className="border-2 border-dashed border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clapperboard className="size-4 text-primary" />
            Video Concept
          </CardTitle>
          <Badge variant="secondary" className="text-[10px] font-normal">
            <ListChecks className="size-3 mr-1" />
            Overview
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Concept Paragraph */}
        <div className="rounded-lg bg-muted/40 border border-border/50 p-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {conceptLines.length > 0
              ? conceptLines.join(' ')
              : `This script covers "${title}" — configure project metadata to see a full concept summary.`}
          </p>
        </div>

        <Separator />

        {/* Main Topics with Bullets */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Main Topics & Settings
          </h4>
          <ul className="space-y-1.5">
            {topicBullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/80">
                <span className="mt-0.5 shrink-0">{bullet.icon}</span>
                <span>{bullet.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
