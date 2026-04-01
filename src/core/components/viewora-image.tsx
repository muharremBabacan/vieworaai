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
    smallSquare: 'aspect-square object-cover',
    featureCover: 'aspect-video object-cover',
    detailView: 'aspect-[4/5] object-contain bg-black/5',
    detailViewWatermarked: 'aspect-[4/5] object-contain bg-black/5',
    analysis: 'object-contain',
    original: 'object-contain'
  };

  // 3. Optimizasyon (Next.js Image)
  // Sizes özniteliği tarayıcıya hangi boyutu indirmesi gerektiğini söyler (LCP optimizasyonu)
  const sizes = props.sizes || (
    type === 'smallSquare' 
      ? '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px' 
      : type === 'featureCover'
      ? '100vw'
      : '(max-width: 1024px) 100vw, 1200px'
  );

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      <Image
        src={src}
        alt={alt || "Viewora Visual"}
        fill
        sizes={sizes}
        className={cn(
          "transition-all duration-700",
          ratioClasses[type],
          className
        )}
        {...props}
      />
    </div>
  );
}
