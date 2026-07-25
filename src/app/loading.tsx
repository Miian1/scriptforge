'use client';

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-[-8px] rounded-2xl bg-primary/10 animate-ping" />
          <img
            src="/logo.svg"
            alt="ScriptForge"
            className="relative size-16 rounded-xl animate-pulse"
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-foreground animate-pulse">
            ScriptForge
          </span>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
