import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
        </defs>
        {/* Shutter */}
        <path fillRule="evenodd" clipRule="evenodd" d="M16 4.39999C22.41 4.39999 27.6 9.58999 27.6 16C27.6 22.41 22.41 27.6 16 27.6C9.58 27.6 4.39999 22.41 4.39999 16C4.39999 9.58999 9.58 4.39999 16 4.39999Z" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16.0001 16L23.2001 9.60001C22.0905 8.5801 20.655 8 19.1001 8H12.9001C11.3451 8 9.91049 8.5801 8.80005 9.60001L16.0001 16Z" fill="url(#logo-gradient)"/>
        <path d="M16 16L22.4 23.2C21.4201 24.0895 20.155 24.6 18.8 24.6H13.2C11.845 24.6 10.5799 24.0895 9.60001 23.2L16 16Z" fill="url(#logo-gradient)"/>
        <path d="M16 16L9.60001 8.80005C8.5801 9.90964 8 11.345 8 12.9V19.1C8 20.655 8.5801 22.0904 9.60001 23.2L16 16Z" fill="url(#logo-gradient)"/>
        <path d="M16 16L23.2 22.4C24.0895 21.4201 24.6 20.155 24.6 18.8V13.2C24.6 11.845 24.0895 10.58 23.2 9.60001L16 16Z" fill="url(#logo-gradient)"/>

        {/* Circuitry */}
        <circle cx="4" cy="16" r="1.5" fill="url(#logo-gradient)" />
        <path d="M4 16H1.5" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeLinecap="round"/>

        <circle cx="28" cy="16" r="1.5" fill="url(#logo-gradient)" />
        <path d="M28 16H30.5" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeLinecap="round"/>

        <circle cx="8.8" cy="9.6" r="1.5" fill="url(#logo-gradient)" />
        <path d="M8.8 9.6L7 7.8" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeLinecap="round"/>
        
        <circle cx="23.2" cy="9.6" r="1.5" fill="url(#logo-gradient)" />
        <path d="M23.2 9.6L25 7.8" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeLinecap="round"/>
        
        <circle cx="8.8" cy="22.4" r="1.5" fill="url(#logo-gradient)" />
        <path d="M8.8 22.4L7 24.2" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeLinecap="round"/>

        <circle cx="23.2" cy="22.4" r="1.5" fill="url(#logo-gradient)" />
        <path d="M23.2 22.4L25 24.2" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span className="font-sans text-xl font-semibold tracking-wider bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
        Viewora
      </span>
    </div>
  );
}
