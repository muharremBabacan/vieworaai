import sharp from 'sharp';
import fs from 'fs';

async function testSharp() {
  console.log('🧪 Testing Sharp native loading...');
  try {
    const info = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 }
      }
    }).png().toBuffer();
    console.log('✅ Sharp is working! Buffer length:', info.length);
  } catch (err) {
    console.error('❌ Sharp failed to load or run:', err.message);
    process.exit(1);
  }
}

testSharp();
