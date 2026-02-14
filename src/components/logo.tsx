import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <svg
        viewBox="0 0 64 48"
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
        
        {/* Aperture Blades */}
        <g transform="translate(32 24)">
            <path fillRule="evenodd" clipRule="evenodd" d="M-8.66 15L0 0L8.66 15L0 18L-8.66 15Z" fill="url(#logoGrad)"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M-8.66 15L0 0L8.66 15L0 18L-8.66 15Z" transform="rotate(60)" fill="url(#logoGrad)"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M-8.66 15L0 0L8.66 15L0 18L-8.66 15Z" transform="rotate(120)" fill="url(#logoGrad)"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M-8.66 15L0 0L8.66 15L0 18L-8.66 15Z" transform="rotate(180)" fill="url(#logoGrad)"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M-8.66 15L0 0L8.66 15L0 18L-8.66 15Z" transform="rotate(240)" fill="url(#logoGrad)"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M-8.66 15L0 0L8.66 15L0 18L-8.66 15Z" transform="rotate(300)" fill="url(#logoGrad)"/>
        </g>
        
        {/* Outer Ring and Circuits */}
        <path d="M16 24C12.131 24 8.76133 21.8463 7 18.8475" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round"/>
        <path d="M48 24C51.869 24 55.2387 21.8463 57 18.8475" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 24C12.131 24 8.76133 26.1537 7 29.1525" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round"/>
        <path d="M48 24C51.869 24 55.2387 26.1537 57 29.1525" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round"/>
        
        <circle cx="5" cy="16" r="2" stroke="url(#logoGrad)" strokeWidth="1.5"/>
        <circle cx="59" cy="16" r="2" stroke="url(#logoGrad)" strokeWidth="1.5"/>
        <circle cx="5" cy="32" r="2" stroke="url(#logoGrad)" strokeWidth="1.5"/>
        <circle cx="59" cy="32" r="2" stroke="url(#logoGrad)" strokeWidth="1.5"/>
        
        <path d="M3 12L5 16L3 20" stroke="url(#logoGrad)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M61 12L59 16L61 20" stroke="url(#logoGrad)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M3 28L5 32L3 36" stroke="url(#logoGrad)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M61 28L59 32L61 36" stroke="url(#logoGrad)" strokeWidth="1.5" strokeLinecap="round"/>
        
        <circle cx="1.5" cy="10" r="1.5" fill="url(#logoGrad)"/>
        <circle cx="62.5" cy="10" r="1.5" fill="url(#logoGrad)"/>
        <circle cx="1.5" cy="38" r="1.5" fill="url(#logoGrad)"/>
        <circle cx="62.5" cy="38" r="1.5" fill="url(#logoGrad)"/>
      </svg>
      <span className="font-sans text-xl font-semibold tracking-wider bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
        Viewora
      </span>
    </div>
  );
}
