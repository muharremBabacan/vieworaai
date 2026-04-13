/**
 * Client-side image utility functions for Viewora.
 * These functions run ONLY in the browser.
 */

/**
 * Gets the natural width and height of an image file.
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url); // 🔥 Cleanup memory
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  });
}

/**
 * Generates a SHA-256 hash of a file for uniqueness checks.
 */
export async function generateImageHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resizes an image file to a maximum dimension while maintaining aspect ratio.
 * Converts to JPEG for consistency and smaller file size.
 */
export async function resizeImage(file: File, maxDimension: number = 1600): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
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
        
        // Draw into canvas (resizing)
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to Blob as JPEG (quality 0.85)
        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/jpeg', 0.85);
      };
      
      // Error handling for image loading
      img.onerror = () => reject(new Error('Image loading failed'));
      img.src = e.target?.result as string;
    };
    
    // Error handling for file reading
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Centralized function to prepare any image for upload.
 * It checks the minimum resolution and resizes the file if needed.
 * @throws Error 'PHOTO_TOO_SMALL' if longest edge is less than 800px.
 */
export async function prepareOptimizedFile(file: File, maxDimension: number = 1600): Promise<File> {
  // 1. Check dimensions
  const dims = await getImageDimensions(file);
  const longestEdge = Math.max(dims.width, dims.height);
  
  if (longestEdge < 800) {
    throw new Error('PHOTO_TOO_SMALL');
  }

  // 2. Resize and optimize
  return await resizeImage(file, maxDimension);
}
