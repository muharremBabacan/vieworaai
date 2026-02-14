import Image from 'next/image';
import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  // Firebase Storage'dan aldığımız Public Access Token'lı URL
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/studio-8632782825-fce99.firebasestorage.app/o/user-uploads%2Fviewora_logok01.png?alt=media&token=a6e7a558-eaf1-46dd-946e-a61e47d080cc";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative h-20 w-20"> {/* Boyutu görünürlük için 20 yaptık */}
        <Image
          src={logoUrl}
          alt="Viewora Logo"
          fill
          className="object-contain"
          priority // Logonun her şeyden önce yüklenmesini sağlar
          unoptimized={true} // Firebase URL'lerinde Next.js işlemci hatalarını (400) engeller
        />
      </div>
      <span className="font-sans text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
        Viewora
      </span>
    </div>
  );
}