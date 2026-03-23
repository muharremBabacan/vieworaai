// check_missing.mjs
// Bu dosya, tüm sayfalarda tespit edilen ve dil dosyalarında (en.json, tr.json vb.) eksik olan
// "sert kodlanmış" (hardcoded) metinlerin listesini ve eklenecek yeni anahtarları içerir.

export const NEW_KEYS_TO_ADD = {
  AppLayout: {
    fallback_artist: { tr: "Sanatçı", en: "Anonymous Artist" },
  },
  GalleryPage: {
    filter_category_portrait: { tr: "Portre", en: "Portrait" },
    filter_category_landscape: { tr: "Manzara", en: "Landscape" },
    filter_category_street: { tr: "Sokak", en: "Street" },
    filter_category_architecture: { tr: "Mimari", en: "Architecture" },
    filter_category_pets: { tr: "Evcil Hayvanlar", en: "Pets" },
    filter_category_macro: { tr: "Makro", en: "Macro" },
  },
  GroupsPage: {
    purpose_study: { tr: "Eğitim", en: "Study" },
    purpose_challenge: { tr: "Yarışma", en: "Challenge" },
    purpose_walk: { tr: "Gezi", en: "Photo Walk" },
    purpose_mentor: { tr: "Eğitimci", en: "Mentor" },
  },
  ProfilePage: {
    fallback_user: { tr: "Kullanıcı", en: "User" },
    daily_active_badge: { tr: "GÜNLÜK AKTİF", en: "DAILY ACTIVE" },
    user_not_found: { tr: "Kullanıcı bulunamadı.", en: "User not found." },
  },
  SettingsPage: {
    profile_settings: { tr: "Profil Ayarları", en: "Profile Settings" },
    nickname_label: { tr: "Takma Ad", en: "Nickname" },
    phone_label: { tr: "Telefon", en: "Phone" },
    instagram_label: { tr: "Instagram", en: "Instagram" },
    save_button: { tr: "Kaydet", en: "Save" },
    toast_profile_updated: { tr: "Profil Güncellendi", en: "Profile Updated" },
    toast_error: { tr: "Hata", en: "Error" },
    language_label: { tr: "Dil / Language", en: "Language" },
    select_avatar: { tr: "Simge Seçin", en: "Select Avatar" },
    toast_avatar_updated: { tr: "Avatar Güncellendi", en: "Avatar Updated" },
    badge_guide_title: { tr: "Rozet ve Seviye Rehberi", en: "Badge and Level Guide" },
    streak_title: { tr: "Günlük Seri (Streak)", en: "Daily Streak" },
    streak_desc: { tr: "Viewora'da kaç gün üst üste aktif olduğunuzu gösterir.", en: "Shows how many consecutive days you have been active on Viewora." },
    ranks_xp_title: { tr: "Rütbeler ve XP", en: "Ranks and XP" },
    app_and_account: { tr: "Uygulama & Hesap", en: "App & Account" },
    dev_tools_title: { tr: "Geliştirici Araçları", en: "Developer Tools" },
    dev_level_simulator: { tr: "Seviye Simülatörü", en: "Level Simulator" },
    dev_tier_simulator: { tr: "Paket Simülatörü", en: "Package Simulator" },
    toast_level_updated: { tr: "Seviye Güncellendi", en: "Level Updated" },
    toast_tier_updated: { tr: "Paket Değişti", en: "Package Changed" },
    please_login: { tr: "Lütfen giriş yapın.", en: "Please log in." },
  },
  AdminPanel: {
    title: { tr: "Akademi İçerik Robotu", en: "Academy Content Bot" },
    description: { tr: "Müfredata dayalı dersleri Gemini 2.0 Flash ile üretin.", en: "Generate curriculum-based lessons with Gemini 2.0 Flash." },
    badge_active: { tr: "IMAGEN 3.0 & FLASH 2.0 AKTİF", en: "IMAGEN 3.0 & FLASH 2.0 ACTIVE" },
    label_level: { tr: "Eğitim Seviyesi", en: "Education Level" },
    label_category: { tr: "Kategori (Müfredat)", en: "Category (Curriculum)" },
    placeholder_category: { tr: "Kategori seçin...", en: "Select category..." },
    btn_generate_single: { tr: "Tek Ders Üret", en: "Generate Single Lesson" },
    btn_generate_ten: { tr: "10 Ders Üret", en: "Generate 10 Lessons" },
    toast_select_category: { tr: "Lütfen önce bir kategori seçin.", en: "Please select a category first." },
    toast_lesson_ready_title: { tr: "Ders İçeriği Hazır!", en: "Lesson Content Ready!" },
    toast_lesson_ready_desc: { tr: "Görsel ipucu laboratuvara aktarıldı. Lütfen aşağıdan onaylayıp görseli üretin.", en: "Visual hint transferred to lab. Please confirm and generate below." },
    toast_drafts_ready: { tr: "Taslak Hazır", en: "Drafts Ready" },
    toast_success: { tr: "Başarılı!", en: "Success!" },
    toast_lessons_published: { tr: "ders yayınlandı.", en: "lessons published." },
    preview_title: { tr: "Taslak Önizleme", en: "Draft Preview" },
    preview_clear: { tr: "Temizle", en: "Clear" },
    preview_publish_all: { tr: "Tümünü Otomatik Yayınla", en: "Publish All Automatically" },
    image_lab_title: { tr: "Görsel Üretim Laboratuvarı", en: "Image Generation Lab" },
    image_lab_desc: { tr: "Üretilen dersin görsel ipucunu burada onaylayıp görseli oluşturun.", en: "Confirm the visual hint here and generate the image." },
    btn_generate_image: { tr: "Görsel Üret", en: "Generate Image" },
    btn_save_folder: { tr: "Sadece Klasöre Kaydet", en: "Save to Folder Only" },
    toast_image_generated: { tr: "Görsel Üretildi", en: "Image Generated" },
    toast_image_saved: { tr: "Görsel Kaydedildi", en: "Image Saved" },
    toast_image_missing: { tr: "Lütfen önce görseli üretin.", en: "Please generate the image first." },
  }
};

/* 
 * PLAN:
 * 1. Yukarıdaki listeyi onayladığınızda, `update_en_tr.mjs` benzeri bir script ile 
 *    bu anahtarları otomatik olarak en.json ve tr.json'a ekleyeceğim.
 * 2. Ardından ilgili sayfalara (SettingsPage, ProfilePage vb.) girip 
 *    hardcoded olan yazıları t('key') ile değiştireceğim.
 * 3. En son olarak, tüm bu eklenen yeni anahtarları diğer 6 dil dosyasına da
 *    (es, fr, de, vb.) taratıp eksik olanları Google Translate veya uygun 
 *    bir yöntemle senkronize edeceğim.
 */
