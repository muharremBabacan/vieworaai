import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

/**
 * Viewora Görsel İşleme Motoru (Sharp tabanlı)
 * Tüm görsel türevlerini (derivatives) belirlediğimiz standartlara göre üretir.
 */

export type DerivativeType = 'smallSquare' | 'featureCover' | 'detailView' | 'detailViewWatermarked' | 'analysis';

export interface ProcessingResult {
  type: DerivativeType;
  buffer: Buffer;
  format: 'webp' | 'jpeg';
  width: number;
  height: number;
}

export class ImageProcessor {
  private buffer: Buffer;
  private rotatedBuffer: Buffer | null = null;
  private watermarkBuffer: Buffer | null = null;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  /**
   * Base optimizasyon: Görseli bir kere döndürür ve tampona alır.
   * Bu sayede her türev için tekrar döndürme işlemi yapılmasına gerek kalmaz.
   */
  private async getRotatedPipeline() {
    if (!this.rotatedBuffer) {
      this.rotatedBuffer = await sharp(this.buffer).rotate().toBuffer();
    }
    return sharp(this.rotatedBuffer);
  }

  /**
   * Watermark olarak kullanılacak logoyu yükler
   */
  async loadWatermark(watermarkPath: string) {
    if (fs.existsSync(watermarkPath)) {
      this.watermarkBuffer = await fs.promises.readFile(watermarkPath);
    }
  }

  /**
   * Görselin boyutlarını kontrol eder. 
   * Artık kısıtlayıcı değil; küçük görseller otomatik büyütülecek.
   */
  async validateResolution(): Promise<{ width: number; height: number }> {
    const metadata = await sharp(this.buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const maxEdge = Math.max(width, height);

    console.log(`📏 [processor] Image dimensions: ${width}x${height} (maxEdge: ${maxEdge})`);
    
    if (maxEdge < 400) {
      console.warn('⚠️ [processor] Resolution is very low (<400px), clarity might be poor.');
    }

    return { width, height };
  }

  /**
   * Belirli bir türev tipini üretir
   */
  async generateDerivative(type: DerivativeType): Promise<ProcessingResult> {
    const pipeline = await this.getRotatedPipeline();
    const metadata = await pipeline.metadata();

    switch (type) {
      case 'smallSquare':
        // 320x320, 1:1, Center Crop, WebP
        return {
          type,
          buffer: await pipeline
            .resize(320, 320, { fit: 'cover', position: 'center' })
            .webp({ quality: 85 })
            .toBuffer(),
          format: 'webp',
          width: 320,
          height: 320
        };

      case 'featureCover':
        // 1280x720, 16:9, Smart/Center Crop, WebP
        return {
          type,
          buffer: await pipeline
            .resize(1280, 720, { fit: 'cover', position: 'attention' }) // Akıllı crop (attention)
            .webp({ quality: 85 })
            .toBuffer(),
          format: 'webp',
          width: 1280,
          height: 720
        };

      case 'detailView':
        // Max 1200x1500 Bounding Box, No Hard Crop, WebP
        const detailRes = await pipeline
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 })
          .toBuffer();
        
        const detailMeta = await sharp(detailRes).metadata();
        return {
          type,
          buffer: detailRes,
          format: 'webp',
          width: detailMeta.width || 1200,
          height: detailMeta.height || 1500
        };

      case 'detailViewWatermarked':
        // Base rotated image for watermarking
        const baseDetail = await (await this.getRotatedPipeline())
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        
        const baseMeta = await sharp(baseDetail).metadata();
        let finalPipeline = sharp(baseDetail);
        
        if (this.watermarkBuffer) {
           // Watermark boyutunu görsele göre ayarla (yaklaşık %15 genişlik)
           const wmSize = Math.round((baseMeta.width || 1200) * 0.15);
           const resizedWm = await sharp(this.watermarkBuffer)
             .resize(wmSize)
             .png()
             .toBuffer();

           finalPipeline = finalPipeline.composite([
             { 
               input: resizedWm, 
               gravity: 'southeast', 
               blend: 'over'
             }
           ]);
        }

        return {
          type,
          buffer: await finalPipeline.webp({ quality: 90 }).toBuffer(),
          format: 'webp',
          width: baseMeta.width || 1200,
          height: baseMeta.height || 1500
        };

      case 'analysis':
        // Max Long Edge 1600, JPEG (Quality 85), No Crop
        const analysisRes = await pipeline
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        
        const analysisMeta = await sharp(analysisRes).metadata();
        return {
          type,
          buffer: analysisRes,
          format: 'jpeg',
          width: analysisMeta.width || 1600,
          height: analysisMeta.height || 1600
        };

      default:
        throw new Error(`Bilinmeyen türev tipi: ${type}`);
    }
  }

  /**
   * Tüm türevleri SEQUENTIAL olarak üretir (Memory Safety)
   */
  async generateAll(): Promise<Record<DerivativeType, ProcessingResult>> {
    const types: DerivativeType[] = ['smallSquare', 'featureCover', 'detailView', 'detailViewWatermarked', 'analysis'];
    const results: any = {};
    
    for (const type of types) {
      results[type] = await this.generateDerivative(type);
    }
    
    return results;
  }
}
