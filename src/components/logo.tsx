import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <svg
        viewBox="0 0 52 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12"
      >
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
        {/* Outer Ring */}
        <circle cx="26" cy="26" r="24" stroke="url(#logoGrad)" strokeWidth="4" />
        {/* Inner Circle */}
        <circle cx="26" cy="26" r="12" fill="url(#logoGrad)" />
      </svg>
      <span className="font-sans text-xl font-semibold tracking-wider bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
        Viewora
      </span>
    </div>
  );
}
