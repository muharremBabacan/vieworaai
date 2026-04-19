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
  private basePipeline: sharp.Sharp | null = null;
  private watermarkBuffer: Buffer | null = null;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  /**
   * Base optimizasyon: Görseli bir kere döndürür ve base pipeline oluşturur.
   * Sharp .clone() kullanarak her türev için tekrar encode/rotate yapmayız.
   */
  private async getBasePipeline(): Promise<sharp.Sharp> {
    if (!this.basePipeline) {
      const start = Date.now();
      // 🚀 Optimization: Decode once, Rotate once
      const rotatedBuffer = await sharp(this.buffer).rotate().toBuffer();
      this.basePipeline = sharp(rotatedBuffer);
      console.log(`⚡ [processor] Base pipeline prepared (rotation included) in ${Date.now() - start}ms`);
    }
    return this.basePipeline.clone();
  }

  /**
   * Watermark logo yükler
   */
  async loadWatermark(watermarkPath: string) {
    if (fs.existsSync(watermarkPath)) {
      this.watermarkBuffer = await fs.promises.readFile(watermarkPath);
      console.log('✅ [processor] Watermark loaded');
    }
  }

  /**
   * Görsel boyutlarını kontrol eder
   */
  async validateResolution(): Promise<{ width: number; height: number }> {
    const start = Date.now();
    const pipeline = await this.getBasePipeline();
    const metadata = await pipeline.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    console.log(`📏 [processor] Validated: ${width}x${height} in ${Date.now() - start}ms`);
    return { width, height };
  }

  /**
   * Türev üretir
   */
  async generateDerivative(type: DerivativeType): Promise<ProcessingResult> {
    const pipeline = await this.getBasePipeline();
    
    switch (type) {
      case 'smallSquare':
        // 320x320, 1:1, Center Crop, WebP
        const squareBuffer = await pipeline
          .resize(320, 320, { fit: 'cover', position: 'center' })
          .webp({ quality: 85 })
          .toBuffer();
        return { type, buffer: squareBuffer, format: 'webp', width: 320, height: 320 };

      case 'featureCover':
        // 1280x720, 16:9, Attention Crop, WebP
        const featureBuffer = await pipeline
          .resize(1280, 720, { fit: 'cover', position: 'attention' })
          .webp({ quality: 85 })
          .toBuffer();
        return { type, buffer: featureBuffer, format: 'webp', width: 1280, height: 720 };

      case 'detailView':
        // Max 1600x1600 Bounding Box, WebP
        const detailRes = await pipeline
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 })
          .toBuffer();
        const detailMeta = await sharp(detailRes).metadata();
        return { type, buffer: detailRes, format: 'webp', width: detailMeta.width || 1200, height: detailMeta.height || 1500 };

      case 'detailViewWatermarked':
        // Standard Detail + Watermark
        const baseDetail = await pipeline
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        
        const baseMeta = await sharp(baseDetail).metadata();
        let finalPipeline = sharp(baseDetail);
        
        if (this.watermarkBuffer) {
           const wmSize = Math.round((baseMeta.width || 1200) * 0.15);
           const resizedWm = await sharp(this.watermarkBuffer).resize(wmSize).png().toBuffer();
           finalPipeline = finalPipeline.composite([{ input: resizedWm, gravity: 'southeast', blend: 'over' }]);
        }

        const wmResult = await finalPipeline.webp({ quality: 90 }).toBuffer();
        return { type, buffer: wmResult, format: 'webp', width: baseMeta.width || 1200, height: baseMeta.height || 1500 };

      case 'analysis':
        // High Res Analysis (JPEG)
        const analysisRes = await pipeline
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const analysisMeta = await sharp(analysisRes).metadata();
        return { type, buffer: analysisRes, format: 'jpeg', width: analysisMeta.width || 1600, height: analysisMeta.height || 1600 };

      default:
        throw new Error(`Bilinmeyen türev: ${type}`);
    }
  }

  async generateAll(): Promise<Record<DerivativeType, ProcessingResult>> {
    const types: DerivativeType[] = ['smallSquare', 'featureCover', 'detailView', 'detailViewWatermarked', 'analysis'];
    const results: any = {};
    for (const type of types) {
      const start = Date.now();
      results[type] = await this.generateDerivative(type);
      console.log(`  - ${type} generated in ${Date.now() - start}ms`);
    }
    return results;
  }
}
