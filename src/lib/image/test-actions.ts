'use server';

import { getAdminStorage } from '@/lib/firebase/admin-init';
import OpenAI from 'openai';

export async function testUploadAndAnalyze(formData: FormData) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[BuildTime] OPENAI_API_KEY is missing. Skipping analysis (Expected during Build).');
    if (process.env.NODE_ENV === 'production') return { success: false, error: 'Runtime secret missing' };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log('🧪 [TEST-ACTION] Starting simple test...');
  
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    // 1. ROBUST BUCKET ACCESS (Trial & Error for Suffixes)
    let activeBucket = getAdminStorage();
    const baseId = activeBucket.name.split('.')[0];
    const possibleBuckets = [
      activeBucket.name,
      `${baseId}.firebasestorage.app`,
      `${baseId}.appspot.com`
    ];

    let uploadSuccess = false;
    let finalBucket = activeBucket;

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `test-uploads/${Date.now()}-${file.name}`;

    for (const bName of possibleBuckets) {
      try {
        console.log(`📍 [TEST-ACTION] Attempting upload to: ${bName}`);
        const currentBucket = (getAdminStorage() as any).storage.bucket(bName);
        const fileObj = currentBucket.file(filePath);
        
        await fileObj.save(buffer, {
          contentType: file.type,
          metadata: { cacheControl: 'no-cache' }
        });
        
        await fileObj.makePublic().catch(() => {});
        finalBucket = currentBucket;
        uploadSuccess = true;
        break; 
      } catch (e: any) {
        console.warn(`⚠️ [TEST-ACTION] Failed for ${bName}:`, e.message);
      }
    }

    if (!uploadSuccess) {
      throw new Error(`ALL_BUCKETS_FAILED: Tried ${possibleBuckets.join(', ')} but all gave 404.`);
    }

    const imageUrl = `https://storage.googleapis.com/${finalBucket.name}/${filePath}`;
    console.log('✅ [TEST-ACTION] Upload successful:', imageUrl);

    // 3. Simple OpenAI call
    console.log('🤖 [TEST-ACTION] Calling OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is in this image? Give a 1 sentence simple answer." },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    const answer = response.choices[0].message.content;
    console.log('✅ [TEST-ACTION] OpenAI Answer:', answer);

    return {
      success: true,
      bucketUsed: activeBucket.name,
      imageUrl,
      answer
    };

  } catch (error: any) {
    console.error('❌ [TEST-ACTION] FATAL ERROR:', error.message);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}
