'use client';

import dynamic from 'next/dynamic';

const About = dynamic(() => import('@/components/about/About'), {
  ssr: false,
  loading: () => <div className="p-8 text-muted-foreground">Loading...</div>,
});

export default function AboutPage() {
  return <About />;
}