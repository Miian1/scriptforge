'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  TrendingUp,
  Loader2,
  RefreshCw,
  Lightbulb,
  Star,
  History,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';
import { PLAN_LIMITS } from '@/lib/usage';
import { useAppStore } from '@/lib/store';
import type { ScoreEntry } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

interface ProjectScoreCardProps {
  project: {
    id: string;
    status: string;
    scoreHistory: ScoreEntry[];
  };
}

const SCORE_LABELS: Record<string, { label: string }> = {
  titleScore: { label: 'Title' },
  descriptionScore: { label: 'Description' },
  tagsScore: { label: 'Tags SEO' },
  nicheFit: { label: 'Niche Fit' },
  trendScore: { label: 'Trend Align' },
  engagementScore: { label: 'Engagement' },
  seoScore: { label: 'Overall SEO' },
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

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function ScoreDelta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) return <Minus className="size-3 text-muted-foreground" />;
  if (diff > 0) {
    return (
      <span className="flex items-center gap-0.5 text-emerald-500 text-xs font-medium">
        <ArrowUpRight className="size-3" />+{diff}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-red-500 text-xs font-medium">
      <ArrowDownRight className="size-3" />{diff}
    </span>
  );
}

export default function ProjectScoreCard({ project }: ProjectScoreCardProps) {
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ScoreEntry[]>(project.scoreHistory || []);
  const currentScore = history.length > 0 ? history[history.length - 1] : null;

  // Sync history from project prop (e.g. after navigating away and back)
  useEffect(() => {
    if (project.scoreHistory && project.scoreHistory.length > 0) {
      setHistory(project.scoreHistory);
    }
  }, [project.scoreHistory]);

  // Also refresh from store when project updates
  const projects = useAppStore((s) => s.projects);
  const storeProject = projects.find((p) => p.id === project.id);
  useEffect(() => {
    if (storeProject?.scoreHistory && storeProject.scoreHistory.length > 0) {
      setHistory(storeProject.scoreHistory);
    }
  }, [storeProject?.scoreHistory]);

  const fetchScore = useCallback(async () => {
    if (loading) return;

    const user = useAuthStore.getState().user;
    const plan = user?.plan || 'free';
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
        // Update local history with response
        if (data.scoreHistory) {
          setHistory(data.scoreHistory);
        } else if (data.scores) {
          setHistory((prev) => [...prev, data.scores]);
        }
        toast.success('Project scored successfully!');
      } else {
        toast.error(data.error || 'Failed to score project');
      }
    } catch {
      toast.error('Failed to score project');
    } finally {
      setLoading(false);
    }
  }, [project.id, loading]);

  const hasHistory = history.length > 1;

  return (
    <Card className="border-2 border-dashed border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            Project Score
            {currentScore && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({history.length} {history.length === 1 ? 'score' : 'scores'})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={currentScore ? 'default' : 'ghost'}
                  size="sm"
                  onClick={fetchScore}
                  disabled={loading || project.status === 'generating'}
                  className="h-7 gap-1.5 text-xs"
                >
                  {loading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  {currentScore ? 'Regenerate' : 'Score Project'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {currentScore
                  ? 'Re-analyze with latest data (uses AI credit)'
                  : 'AI analyzes your project for YouTube success potential'}
              </TooltipContent>
            </Tooltip>

            {hasHistory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="h-7 gap-1.5 text-xs text-muted-foreground"
              >
                <History className="size-3.5" />
                History
                {showHistory ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!currentScore && !loading && (
          <div className="text-center py-6">
            <Star className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Click &ldquo;Score Project&rdquo; to get an AI-powered analysis
              of your video&apos;s YouTube potential
            </p>
          </div>
        )}

        {loading && !currentScore && (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <Loader2 className="size-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Analyzing project with AI...
            </p>
          </div>
        )}

        {currentScore && (
          <div className="space-y-4">
            {/* Loading overlay indicator on regenerate */}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                Regenerating score...
              </div>
            )}

            {/* Overall Score */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center min-w-[52px]">
                <span className={`text-3xl font-bold ${getScoreColor(currentScore.overallScore)}`}>
                  {currentScore.overallScore}
                </span>
                <span className={`text-xs font-semibold ${getGrade(currentScore.overallScore).className}`}>
                  {getGrade(currentScore.overallScore).letter}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground font-medium">Overall Score</span>
                  <span className="text-muted-foreground">/ 100</span>
                </div>
                <Progress
                  value={currentScore.overallScore}
                  className={`h-2.5 ${getProgressColor(currentScore.overallScore)}`}
                />
              </div>
            </div>

            <Separator />

            {/* Individual Scores */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {Object.entries(SCORE_LABELS).map(([key, { label }]) => {
                const score = currentScore[key as keyof ScoreEntry] as number;
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
            {currentScore.tip && (
              <>
                <Separator />
                <div className="flex gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                  <Lightbulb className="size-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-amber-600 dark:text-amber-400">Pro Tip:</span>{' '}
                    {currentScore.tip}
                  </p>
                </div>
              </>
            )}

            {/* Score History Section */}
            {hasHistory && (
              <>
                <Separator />
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                  >
                    <History className="size-3.5" />
                    Score History
                    <span className="ml-auto">
                      {showHistory ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </span>
                  </button>

                  {showHistory && (
                    <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                      {history
                        .slice()
                        .reverse()
                        .map((entry, idx) => {
                          const prevEntry = idx < history.length - 1 ? history[history.length - 1 - idx - 1] : null;
                          const isLatest = idx === 0;

                          return (
                            <div
                              key={entry.scoredAt}
                              className={`rounded-lg border p-3 transition-colors ${
                                isLatest
                                  ? 'border-primary/30 bg-primary/[0.03]'
                                  : 'border-border/50 bg-muted/30'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-lg font-bold ${getScoreColor(entry.overallScore)}`}>
                                    {entry.overallScore}
                                  </span>
                                  <span className={`text-xs font-semibold ${getGrade(entry.overallScore).className}`}>
                                    {getGrade(entry.overallScore).letter}
                                  </span>
                                  {isLatest && (
                                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                      Latest
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {prevEntry && (
                                    <ScoreDelta
                                      current={entry.overallScore}
                                      previous={prevEntry.overallScore}
                                    />
                                  )}
                                  <span className="text-[11px] text-muted-foreground">
                                    {formatTimeAgo(entry.scoredAt)}
                                  </span>
                                </div>
                              </div>

                              {/* Mini score bars for history entries */}
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                {Object.entries(SCORE_LABELS).map(([key, { label }]) => {
                                  const score = entry[key as keyof ScoreEntry] as number;
                                  return (
                                    <div key={key} className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-muted-foreground w-14 truncate">
                                        {label}
                                      </span>
                                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            score >= 80
                                              ? 'bg-emerald-500'
                                              : score >= 60
                                              ? 'bg-amber-500'
                                              : score >= 40
                                              ? 'bg-orange-500'
                                              : 'bg-red-500'
                                          }`}
                                          style={{ width: `${score}%` }}
                                        />
                                      </div>
                                      <span className={`text-[10px] font-medium tabular-nums w-5 text-right ${getScoreColor(score)}`}>
                                        {score}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}