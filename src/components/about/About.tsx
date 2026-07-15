'use client';

import { motion } from 'framer-motion';
import { Film, Sparkles, Image, Pencil, HardDrive, Moon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI Script Generation',
    description: 'Automatic scene-by-scene script creation with narration',
  },
  {
    icon: Image,
    title: 'Production Prompts',
    description: 'Image and animation prompts for every scene',
  },
  {
    icon: Pencil,
    title: 'Scene Editor',
    description: 'Full editing, drag-and-drop reordering, and regeneration',
  },
  {
    icon: HardDrive,
    title: 'Local Storage',
    description: 'All data stored locally, no account required',
  },
  {
    icon: Moon,
    title: 'Dark Mode',
    description: 'Beautiful light and dark themes',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
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
      className="mx-auto max-w-2xl space-y-8 p-4 sm:p-6"
    >
      {/* App Identity */}
      <motion.div variants={item} className="flex flex-col items-center space-y-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Film className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">ScriptForge</h1>
          <p className="text-lg text-muted-foreground">AI-Powered YouTube Script Studio</p>
        </div>
        <Badge variant="secondary" className="text-xs">
          Version 1.0.0
        </Badge>
      </motion.div>

      {/* Description */}
      <motion.div variants={item} className="text-center">
        <p className="text-muted-foreground leading-relaxed">
          Transform your video ideas into production-ready scripts with AI. ScriptForge uses Google
          Gemini to research topics, build story structures, and generate complete scene-by-scene
          production scripts with narration, image prompts, and animation prompts.
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

      {/* Footer */}
      <motion.div variants={item} className="text-center">
        <p className="text-xs text-muted-foreground">
          Built with Next.js, TypeScript, and Google Gemini
        </p>
      </motion.div>
    </motion.div>
  );
}