import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-8 w-8"
      >
        <defs>
          <linearGradient
            id="logoGradient"
            x1="0"
            y1="0"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#22d3ee" /> {/* cyan-400 */}
            <stop offset="100%" stopColor="#9333ea" /> {/* purple-600 */}
          </linearGradient>
        </defs>
        <path
          d="M16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28Z"
          stroke="url(#logoGradient)"
          strokeWidth="2.5"
        />
        <path
          d="M12.5 12L16 20L19.5 12"
          stroke="url(#logoGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-sans text-xl font-semibold tracking-wider bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
        Viewora
      </span>
    </div>
  );
}
