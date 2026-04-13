/** v3.2.5 - Final Nuclear Cache Bust: Refactored correctly with 'img' declaration */
/**
 * Client-side image utility functions for Viewora.
 * Renamed to force fresh bundle generation.
 */

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image(); // ✅ Explicity declared
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image loading failed in getImageDimensions'));
      };
      
      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateImageHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function resizeImage(file: File, maxDimension: number = 1600): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image(); // ✅ Explicity declared
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height); // ✅ Scoped correctly
        }

        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Canvas toBlob failed in resizeImage'));
          }
        }, 'image/jpeg', 0.85);
      };
      
      img.onerror = () => reject(new Error('Image loading failed inside resizeImage'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('FileReader failed in resizeImage'));
    reader.readAsDataURL(file);
  });
}

export async function prepareOptimizedFile(file: File, maxDimension: number = 1600): Promise<File> {
  const dims = await getImageDimensions(file);
  const longestEdge = Math.max(dims.width, dims.height);
  
  if (longestEdge < 800) {
    throw new Error('PHOTO_TOO_SMALL');
  }

  return await resizeImage(file, maxDimension);
}
