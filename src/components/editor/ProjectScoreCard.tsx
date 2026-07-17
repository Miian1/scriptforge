'use client';

import React, { useState, useCallback } from 'react';
import {
  TrendingUp,
  Loader2,
  RefreshCw,
  Lightbulb,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';
import { PLAN_LIMITS } from '@/lib/usage';
import type { Project } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

interface ScoreData {
  titleScore: number;
  descriptionScore: number;
  tagsScore: number;
  nicheFit: number;
  trendScore: number;
  engagementScore: number;
  seoScore: number;
  overallScore: number;
  tip: string;
}

interface ProjectScoreCardProps {
  project: Project;
}

const SCORE_LABELS: Record<string, { label: string; color: string }> = {
  titleScore: { label: 'Title', color: 'text-blue-500' },
  descriptionScore: { label: 'Description', color: 'text-purple-500' },
  tagsScore: { label: 'Tags SEO', color: 'text-emerald-500' },
  nicheFit: { label: 'Niche Fit', color: 'text-amber-500' },
  trendScore: { label: 'Trend Align', color: 'text-rose-500' },
  engagementScore: { label: 'Engagement', color: 'text-cyan-500' },
  seoScore: { label: 'Overall SEO', color: 'text-orange-500' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

function getProgressColor(score: number): string {
  if (score >= 80) return '[&>div]:bg-emerald-500';
  if (score >= 60) return '[&>div]:bg-amber-500';
  if (score >= 40) return '[&>div]:bg-orange-500';
  return '[&>div]:bg-red-500';
}

function getGrade(score: number): { letter: string; className: string } {
  if (score >= 90) return { letter: 'A+', className: 'text-emerald-500' };
  if (score >= 80) return { letter: 'A', className: 'text-emerald-500' };
  if (score >= 70) return { letter: 'B', className: 'text-blue-500' };
  if (score >= 60) return { letter: 'C', className: 'text-amber-500' };
  if (score >= 50) return { letter: 'D', className: 'text-orange-500' };
  return { letter: 'F', className: 'text-red-500' };
}

export default function ProjectScoreCard({ project }: ProjectScoreCardProps) {
  const [scores, setScores] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchScore = useCallback(async () => {
    if (loading) return;

    // Check plan
    const user = useAuthStore.getState().user;
    const plan = user?.plan || 'free';
    // Score uses AI — treat same as generation
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

    setLoading(true);
    try {
      const res = await fetch('/api/projects/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setScores(data.scores);
      } else {
        toast.error(data.error || 'Failed to score project');
      }
    } catch {
      toast.error('Failed to score project');
    } finally {
      setLoading(false);
    }
  }, [project.id, loading]);

  return (
    <Card className="border-2 border-dashed border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            Project Score
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchScore}
                disabled={loading || project.status === 'generating'}
                className="h-7 gap-1.5 text-xs"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : scores ? (
                  <RefreshCw className="size-3.5" />
                ) : (
                  <Star className="size-3.5" />
                )}
                {scores ? 'Rescore' : 'Score Project'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {scores ? 'Re-analyze with latest data' : 'AI analyzes your project for YouTube success potential'}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        {!scores && !loading && (
          <div className="text-center py-6">
            <Star className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Click &ldquo;Score Project&rdquo; to get an AI-powered analysis
              of your video&apos;s YouTube potential
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <Loader2 className="size-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Analyzing project with AI...
            </p>
          </div>
        )}

        {scores && !loading && (
          <div className="space-y-4">
            {/* Overall Score */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${getScoreColor(scores.overallScore)}`}>
                  {scores.overallScore}
                </span>
                <span className={`text-xs font-semibold ${getGrade(scores.overallScore).className}`}>
                  {getGrade(scores.overallScore).letter}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground font-medium">Overall Score</span>
                  <span className="text-muted-foreground">/ 100</span>
                </div>
                <Progress
                  value={scores.overallScore}
                  className={`h-2.5 ${getProgressColor(scores.overallScore)}`}
                />
              </div>
            </div>

            <Separator />

            {/* Individual Scores */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {Object.entries(SCORE_LABELS).map(([key, { label }]) => {
                const score = scores[key as keyof ScoreData] as number;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-semibold tabular-nums ${getScoreColor(score)}`}>
                        {score}
                      </span>
                    </div>
                    <Progress
                      value={score}
                      className={`h-1.5 ${getProgressColor(score)}`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Tip */}
            {scores.tip && (
              <>
                <Separator />
                <div className="flex gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                  <Lightbulb className="size-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-amber-600 dark:text-amber-400">Pro Tip:</span>{' '}
                    {scores.tip}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}