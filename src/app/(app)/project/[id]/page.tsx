'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { use } from 'react';
import { useAppStore } from '@/lib/store';

const ScriptEditor = dynamic(() => import('@/components/editor/ScriptEditor'), {
  ssr: false,
  loading: () => <div className="p-8 text-muted-foreground">Loading editor...</div>,
});

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);

  useEffect(() => {
    setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  return <ScriptEditor />;
}