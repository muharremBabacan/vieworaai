'use client';

import Image, { ImageProps } from 'next/image';
import { ImageDerivatives } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Viewora Görsel Sunum Bileşeni
 * Yeni türev (derivative) sistemine uygun şekilde optimize edilmiş görselleri yükler.
 */

export type DerivativeType = keyof ImageDerivatives;

interface VieworaImageProps extends Omit<ImageProps, 'src'> {
  variants: ImageDerivatives | undefined | null;
  fallbackUrl?: string;
  type: DerivativeType;
  containerClassName?: string;
}

export function VieworaImage({ 
  variants, 
  type, 
  fallbackUrl, 
  className, 
  containerClassName,
  alt,
  ...props 
}: VieworaImageProps) {
  
  // 1. URL Seçimi
  // Eğer yeni sistem (variants) varsa tipi seç, yoksa fallback kullan, o da yoksa boş dön.
  const src = variants ? variants[type] : fallbackUrl;

  if (!src) {
    return <div className={cn("bg-muted animate-pulse", containerClassName)} />;
  }

  // 2. Boyutlandırma ve Ratio (Tailwind)
  const ratioClasses = {
    smallSquare: 'object-contain',
    featureCover: 'object-contain',
    detailView: 'object-contain',
    detailViewWatermarked: 'object-contain',
    analysis: 'object-contain',
    original: 'object-contain'
  };

  // 3. Optimizasyon (Next.js Image)
  // Sizes özniteliği tarayıcıya hangi boyutu indirmesi gerektiğini söyler (LCP optimizasyonu)
  const sizes = props.sizes || (
    type === 'smallSquare' 
      ? '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 300px' 
      : type === 'featureCover'
      ? '100vw'
      : '(max-width: 1024px) 100vw, 1200px'
  );

  return (
    <div className={cn("relative overflow-hidden w-full h-full bg-black/5", containerClassName)}>
      {/* 🔮 Blurred Background Layer (Glassmorphism effect for non-square ratios) */}
      {type !== 'original' && (
        <div className="absolute inset-0 scale-150 blur-3xl opacity-50 pointer-events-none select-none">
          <Image
            src={src}
            alt=""
            fill
            sizes="30vw"
            className="object-cover"
            priority={props.priority}
          />
        </div>
      )}

      {/* 🖼️ Main Image Layer (Ratio protected) */}
      <Image
        src={src}
        alt={alt || "Viewora Visual"}
        fill
        sizes={sizes}
        className={cn(
          "transition-all duration-1000 ease-in-out z-10",
          ratioClasses[type],
          className
        )}
        {...props}
      />
    </div>
  );
}
