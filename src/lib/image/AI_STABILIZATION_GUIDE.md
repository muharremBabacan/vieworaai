# Viewora AI Analiz Stabilizasyon Kılavuzu

Bu dosya, Nisan 2026'da yaşanan kritik AI analiz hatalarının (Bucket bulunamadı, 0.0 puanlama, dil senkronizasyonu) bir daha yaşanmaması için oluşturulmuştur.

## 1. Firebase Storage - Bucket Çözümlemesi
> [!WARNING]
> Firebase Admin SDK bazen varsayılan bucket adını `viewora-ai.appspot.com` gibi aliaslar ile karıştırabilir. Ancak gerçek bucket `studio-8632782825-fce99.firebasestorage.app` ismindedir.

- **Kural**: Proje ayarlarında veya `admin-init.ts` içinde bucket adını her zaman **tam ve onaylanmış ismiyle** (canonical name) kullanın.
- **Fonksiyon**: `getAdminStorage()` fonksiyonu içerisinde bucket ismini "hardcoded" tutmak, Cloud Functions ve Server Actions arasındaki 404 hatalarını önler.

## 2. AI Şema Uyumluluğu (0.0 Sorunu)
Dashboard'daki puanların `0.0` görünmesinin ana sebebi, AI'nın döndürdüğü JSON anahtarlarının Firestore ve UI tarafındaki sön eklerle (`_score`) uyuşmamasıdır.

- **Zorunlu Anahtarlar**: 
    - `light_score`, `composition_score`, `technical_clarity_score`, `storytelling_score`, `boldness_score`.
- **Kural**: AI Promp'u ve Zod Şeması (`ai.ts` içindeki `PhotoAnalysisSchema`), Firestore'da tanımlı olan `PhotoAnalysis` tipiyle **birebir** aynı anahtarları kullanmalıdır. Bir harf hatası bile tüm puanların sıfırlanmasına neden olur.

## 3. Dil ve Yerelleştirme (Localization)
AI bazen "Teknik İnceleme" (technical_details) alanlarını varsayılan olarak İngilizce döndürebilir.

- **Kural**: Prompt içinde her bir alan için (özellikle `genre`, `scene`, `technical_details`) açıkça "IN TURKISH" veya "TÜRKÇE" talimatı verilmelidir.
- **Kural**: JSON içindeki tüm metinsel değerlerin (string) Türkçe olması prompt'un en sonunda "IMPORTANT" uyarısı ile vurgulanmalıdır.

## 4. Model ve API Yapısı
- **Model**: `gpt-4.1-mini` tercih edilmiştir (Hız ve maliyet dengesi için).
- **Yöntem**: OpenAI'ın standart `chat.completions.create` metodu, `json_object` formatı ile birlikte en stabil sonucu verir.
- **Görsel**: Base64 göndermek yerine her zaman Storage'daki görselin **Signed URL** versiyonunu gönderin (Maliyet tasarrufu ve hız).

## 5. Next.js Server Action Güvenliği
Server Action'larda `adminDb` gibi nesnelerin import edilirken hata vermemesi için `admin-init.ts` içinde exportların net olması (aliasing: `adminDb = getAdminDb()`) ve serialization hatalarını önlemek için final sonucun `JSON.parse(JSON.stringify(result))` ile temizlenmesi hayati önem taşır.

---
*Hazırlayan: Antigravity AI Assistant & Muharrem Babacan*
