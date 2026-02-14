import Image from 'next/image';
import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  // This public URL is constructed from the gs:// URI you provided.
  // For this to work, the image file MUST be publicly readable in Firebase Storage.
  // The path has been adjusted to match the app's security rules.
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/studio-8632782825-fce99.appspot.com/o/users%2FBLxfoAPsRyOMTkrKD9EoLtt47Fo1%2Fuploads%2Fviewora_logok01.png?alt=media";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative h-12 w-12">
        <Image
          src={logoUrl}
          alt="Viewora Logo"
          fill
          style={{ objectFit: "contain" }}
          priority // Prioritize loading the logo
        />
      </div>
      <span className="font-sans text-xl font-semibold tracking-wider bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
        Viewora
      </span>
    </div>
  );
}
