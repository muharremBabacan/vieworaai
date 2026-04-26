const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions/v1"); // Explicitly use V1 for Auth triggers
const admin = require("firebase-admin");
const OpenAI = require("openai");

admin.initializeApp();

/**
 * 🛰️ ON USER CREATED (Safety Net)
 * This function runs automatically when a new user is created in Firebase Auth.
 * It ensures the Firestore document is created even if the client-side PWA crashes.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const db = admin.firestore();
  
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    console.log(`🆕 [onUserCreated] Initializing profile for ${uid}`);
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    
    const provider = user.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email';
    
    const newUser = {
      id: uid,
      email: user.email || "",
      name: user.displayName?.split(' ')[0] || "İsimsiz Sanatçı",
      photoURL: user.photoURL || null,
      phone: '',
      instagram: '',
      auro_balance: 0,
      pix_balance: 20, // Start balance
      current_xp: 0,
      level_name: 'Neuner',
      tier: 'start',
      total_analyses_count: 0,
      total_mentor_analyses_count: 0,
      total_exhibitions_count: 0,
      total_competitions_count: 0,
      weekly_free_refill_date: now,
      onboarded: false,
      emailVerified: user.emailVerified || false,
      daily_streak: 1,
      last_active_date: today,
      last_auro_refill_date: today,
      completed_modules: [],
      interests: [],
      createdAt: now,
      provider: provider
    };

    // 1. Create Main User Doc
    await userRef.set(newUser);

    // 2. Create Public Profile
    await db.collection("public_profiles").doc(uid).set({
      id: uid,
      name: newUser.name,
      email: newUser.email,
      photoURL: newUser.photoURL,
      level_name: 'Neuner',
      phone: '',
      instagram: ''
    });

    // 3. Create Welcome Notification
    await userRef.collection("notifications").doc("welcome").set({
      id: 'welcome',
      title: "Vizyon Analizi Bekliyor",
      message: "Luma seni tanımak istiyor. Lütfen anketi doldurun.",
      type: 'system',
      createdAt: now
    });

    console.log(`✅ [onUserCreated] Profile sync complete for ${uid}`);
  } else {
    console.log(`ℹ️ [onUserCreated] Profile already exists for ${uid}, skipping.`);
  }
});

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