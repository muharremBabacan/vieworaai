const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const OpenAI = require("openai");

admin.initializeApp();

exports.analyzePhoto = onRequest(
  { cors: true, secrets: ["OPENAI_API_KEY"] },
  async (req, res) => {

    console.log("🚀 [AI-REACHED] Function execution started");
    console.log("🔑 OPENAI KEY EXISTS:", !!process.env.OPENAI_API_KEY);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const BACKEND_VERSION = "V9-FINAL-STABLE";

    // 🔒 Fallback (asla crash yok)
    const fallbackResponse = {
      light_score: 0,
      composition_score: 0,
      technical_clarity_score: 0,
      storytelling_score: 0,
      boldness_score: 0,
      tags: ["analysis_failed"],
      summary: "Analysis failed. Please try again.",
      backend_version: BACKEND_VERSION,
      error_marker: true
    };

    try {
      // CORS
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        return res.status(204).send('');
      }

      if (req.method !== 'POST') {
        return res.status(405).send("Method Not Allowed");
      }

      // 🔴 FRONTEND UYUMLU PARAMETRE
      const { photoUrl, imageUrl, filePath, userId, photoId } = req.body;

      console.log("🧪 INPUT:", { photoUrl, imageUrl, filePath, userId, photoId });

      const finalImageUrl = photoUrl || imageUrl;

      if (!finalImageUrl && !filePath) {
        console.error("❌ No image provided");
        return res.status(400).json(fallbackResponse);
      }

      // 🔥 STORAGE PATH ÇIKAR
      let finalPath = filePath;

      if (!finalPath && finalImageUrl) {
        try {
          finalPath = finalImageUrl
            .split('/o/')[1]
            .split('?')[0]
            .replace(/%2F/g, '/');
        } catch (e) {
          console.error("❌ URL parse failed");
          return res.status(400).json(fallbackResponse);
        }
      }

      // 🔥 SIGNED URL OLUŞTUR
      const bucket = admin.storage().bucket();
      const [signedUrl] = await bucket.file(finalPath).getSignedUrl({
        action: 'read',
        expires: '03-01-2500',
      });

      console.log("🔗 SIGNED URL CREATED");

      // 🔥 OPENAI ÇAĞRISI
      console.log("🤖 Calling OpenAI...");

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this photo. Return JSON with scores (0-100) for light, composition, technical_clarity, storytelling, boldness. Also include 3-5 tags and a short 1 sentence summary."
              },
              {
                type: "image_url",
                image_url: {
                  url: signedUrl,
                  detail: "low"
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      });

      let parsed = {};

      try {
        parsed = JSON.parse(aiResponse.choices[0].message.content || "{}");
      } catch (e) {
        console.error("⚠️ JSON parse failed");
        parsed = {};
      }

      // 🔥 SONUÇ NORMALİZE
      const finalResult = {
        light_score: Number(parsed.light_score) || 0,
        composition_score: Number(parsed.composition_score) || 0,
        technical_clarity_score: Number(parsed.technical_clarity_score) || 0,
        storytelling_score: Number(parsed.storytelling_score) || 0,
        boldness_score: Number(parsed.boldness_score) || 0,
        tags: Array.isArray(parsed.tags) ? parsed.tags : ["photography"],
        summary: parsed.summary || "No summary provided.",
        backend_version: BACKEND_VERSION
      };

      // 🔥 FIRESTORE SAVE
      const photoRef = admin.firestore().doc(`users/${userId}/photos/${photoId}`);

      await photoRef.set({
        aiFeedback: finalResult,
        analyzedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log("✅ Analysis saved:", photoId);

      return res.status(200).json(finalResult);

    } catch (error) {
      console.error("🔥 CRITICAL ERROR:", error);
      return res.status(200).json(fallbackResponse);
    }
  }
);