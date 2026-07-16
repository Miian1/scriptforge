'use client';

import { motion } from 'framer-motion';
import { Youtube, Sparkles, MessageSquare, Pencil, Wand2, Shield, BarChart3, Layers, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI Script Generation',
    description: 'Generate complete scene-by-scene scripts with narration, image prompts, and animation directions using Google Gemini AI.',
  },
  {
    icon: Youtube,
    title: 'YouTube Integration',
    description: 'Connect your YouTube channel to view stats, browse recent videos, and manage your content — all from one dashboard.',
  },
  {
    icon: MessageSquare,
    title: 'AI Comment Replies',
    description: 'Generate contextual AI replies to your video comments and post them directly to YouTube with one click.',
  },
  {
    icon: Wand2,
    title: 'Video Metadata AI',
    description: 'AI-powered description and tag improvement. Generate optimized metadata and apply it to your videos instantly.',
  },
  {
    icon: Layers,
    title: 'Scene-by-Scene Editor',
    description: 'Full editing with drag-and-drop reordering, scene regeneration, and production-ready script export.',
  },
  {
    icon: BarChart3,
    title: 'Channel Analytics',
    description: 'View subscriber count, total views, video count, and per-video performance — right on your dashboard.',
  },
  {
    icon: Globe,
    title: 'Multi-Language Support',
    description: 'Create scripts in 10 languages including English, Spanish, French, Japanese, Hindi, and Arabic.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'JWT authentication, email verification, and secure OAuth — your data stays safe and private.',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function AboutPage() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6"
    >
      {/* App Identity */}
      <motion.div variants={item} className="flex flex-col items-center space-y-4 text-center">
        <img
          src="/logo.svg"
          alt="ScriptForge"
          className="h-14 w-14 rounded-2xl"
        />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">ScriptForge</h1>
          <p className="text-lg text-muted-foreground">AI YouTube Scripting Agent</p>
        </div>
        <Badge variant="secondary" className="text-xs">
          Version 1.0.0
        </Badge>
      </motion.div>

      {/* Description */}
      <motion.div variants={item} className="text-center">
        <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          ScriptForge is your all-in-one YouTube content creation toolkit. Connect your channel,
          generate production-ready scripts with AI, improve your video metadata, reply to comments
          intelligently, and manage your entire content workflow from a single dashboard.
        </p>
      </motion.div>

      <Separator />

      {/* Features */}
      <motion.div variants={item} className="space-y-4">
        <h2 className="text-center text-lg font-semibold">Features</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={item}
                className="group"
              >
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium leading-none">{feature.title}</h3>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <Separator />

      {/* Tech Stack */}
      <motion.div variants={item} className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Built With</h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {['Next.js', 'TypeScript', 'Google Gemini', 'YouTube Data API', 'MongoDB Atlas', 'Tailwind CSS'].map((tech) => (
            <Badge key={tech} variant="outline" className="text-xs">
              {tech}
            </Badge>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}