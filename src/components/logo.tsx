import Image from 'next/image';
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: 'default' | 'header';
}

export default function Logo({ className, variant = 'default' }: LogoProps) {
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/studio-8632782825-fce99.appspot.com/o/user-uploads%2Fviewora_logok01.png?alt=media&token=a6e7a558-eaf1-46dd-946e-a61e47d080cc";

  const isHeader = variant === 'header';

  return (
    <div className={cn(
      "flex items-center", 
      isHeader ? "flex-row" : "flex-col gap-3",
      className
    )}>
      <div className={cn("relative", isHeader ? "h-8 w-8" : "h-20 w-20")}>
        <Image
          src={logoUrl}
          alt="Viewora Logo"
          fill
          className="object-contain"
          priority
          unoptimized={true} 
        />
      </div>
      {!isHeader && (
        <span className="font-sans text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
          Viewora
        </span>
      )}
    </div>
  );
}
