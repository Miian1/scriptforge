'use client';

import dynamic from 'next/dynamic';

const CreateProject = dynamic(() => import('@/components/project/CreateProject'), {
  ssr: false,
  loading: () => <div className="p-8 text-muted-foreground">Loading...</div>,
});

export default function CreateProjectPage() {
  return <CreateProject />;
}