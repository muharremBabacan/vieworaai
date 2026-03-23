import fs from 'fs';
import path from 'path';

const msgDir = path.join(process.cwd(), 'src', 'messages');

// Here is the pre-computed translation dictionary from the AI Model:
const TRANSLATIONS = {
  // language keys: es, fr, de, ru, ar, zh
  GalleryPage: {
    filter_category_portrait: { es: "Retrato", fr: "Portrait", de: "Porträt", ru: "Портрет", ar: "صورة", zh: "肖像" },
    filter_category_landscape: { es: "Paisaje", fr: "Paysage", de: "Landschaft", ru: "Пейзаж", ar: "منظر طبيعي", zh: "风景" },
    filter_category_street: { es: "Calle", fr: "Rue", de: "Straße", ru: "Улица", ar: "شارع", zh: "街景" },
    filter_category_architecture: { es: "Arquitectura", fr: "Architecture", de: "Architektur", ru: "Архитектура", ar: "هندسة معمارية", zh: "建筑" },
    filter_category_pets: { es: "Mascotas", fr: "Animaux", de: "Haustiere", ru: "Питомцы", ar: "حيوانات أليفة", zh: "宠物" },
    filter_category_macro: { es: "Macro", fr: "Macro", de: "Makro", ru: "Макро", ar: "ماكرو", zh: "微距" }
  },
  GroupsPage: {
    purpose_study: { es: "Estudio", fr: "Étude", de: "Lernen", ru: "Учеба", ar: "دراسة", zh: "学习" },
    purpose_challenge: { es: "Desafío", fr: "Défi", de: "Herausforderung", ru: "Челлендж", ar: "تحدي", zh: "挑战" },
    purpose_walk: { es: "Paseo Fotográfico", fr: "Promenade Photo", de: "Fotospaziergang", ru: "Фотопрогулка", ar: "جولة تصوير", zh: "摄影漫步" },
    purpose_mentor: { es: "Mentor", fr: "Mentor", de: "Mentor", ru: "Наставник", ar: "مرشد", zh: "导师" }
  },
  ProfilePage: {
    fallback_user: { es: "Usuario", fr: "Utilisateur", de: "Benutzer", ru: "Пользователь", ar: "مستخدم", zh: "用户" },
    daily_active_badge: { es: "ACTIVO DIARIO", fr: "ACTIF QUOTIDIEN", de: "TÄGLICH AKTIV", ru: "АКТИВЕН ЕЖЕДНЕВНО", ar: "نشط يوميا", zh: "每日活跃" },
    user_not_found: { es: "Usuario no encontrado.", fr: "Utilisateur introuvable.", de: "Benutzer nicht gefunden.", ru: "Пользователь не найден.", ar: "المستخدم غير موجود.", zh: "未找到用户。" }
  },
  SettingsPage: {
    profile_settings: { es: "Configuración de Perfil", fr: "Paramètres du Profil", de: "Profileinstellungen", ru: "Настройки Профиля", ar: "إعدادات الملف الشخصي", zh: "个人资料设置" },
    nickname_label: { es: "Apodo", fr: "Surnom", de: "Spitzname", ru: "Никнейм", ar: "لقب", zh: "昵称" },
    phone_label: { es: "Teléfono", fr: "Téléphone", de: "Telefon", ru: "Телефон", ar: "هاتف", zh: "电话" },
    instagram_label: { es: "Instagram", fr: "Instagram", de: "Instagram", ru: "Instagram", ar: "إنستغرام", zh: "Instagram" },
    save_button: { es: "Guardar", fr: "Enregistrer", de: "Speichern", ru: "Сохранить", ar: "حفظ", zh: "保存" },
    toast_profile_updated: { es: "Perfil Actualizado", fr: "Profil Mis à Jour", de: "Profil aktualisiert", ru: "Профиль Обновлен", ar: "تم تحديث الملف الشخصي", zh: "资料已更新" },
    toast_error: { es: "Error", fr: "Erreur", de: "Fehler", ru: "Ошибка", ar: "خطأ", zh: "错误" },
    language_label: { es: "Idioma", fr: "Langue", de: "Sprache", ru: "Язык", ar: "اللغة", zh: "语言" },
    select_avatar: { es: "Seleccionar Avatar", fr: "Sélectionner un Avatar", de: "Avatar auswählen", ru: "Выбрать Аватар", ar: "اختر صورة رمزية", zh: "选择头像" },
    toast_avatar_updated: { es: "Avatar Actualizado", fr: "Avatar Mis à Jour", de: "Avatar aktualisiert", ru: "Аватар Обновлен", ar: "تم تحديث الصورة الرمزية", zh: "头像已更新" },
    badge_guide_title: { es: "Guía de Insignias y Niveles", fr: "Guide des Badges et Niveaux", de: "Abzeichen und Level Guide", ru: "Руководство по Значкам и Уровням", ar: "دليل الشارات والمستويات", zh: "徽章和等级指南" },
    streak_title: { es: "Racha Diaria", fr: "Série Quotidienne", de: "Tägliche Strähne", ru: "Ежедневная Серия", ar: "السلسلة اليومية", zh: "每日打卡" },
    streak_desc: { es: "Muestra tu actividad consecutiva.", fr: "Montre l'activité consécutive.", de: "Zeigt die aufeinanderfolgende Aktivität.", ru: "Показывает последовательную активность.", ar: "يعرض النشاط المتتالي.", zh: "显示连续活跃天数。" },
    ranks_xp_title: { es: "Rangos y XP", fr: "Rangs et XP", de: "Ränge und XP", ru: "Ранги и XP", ar: "الرتب ونقاط الخبرة", zh: "等级和经验值" },
    app_and_account: { es: "Aplicación y Cuenta", fr: "Application & Compte", de: "App & Konto", ru: "Приложение и Аккаунт", ar: "التطبيق والحساب", zh: "应用与账户" },
    dev_tools_title: { es: "Herramientas de Desarrollador", fr: "Outils de Développement", de: "Entwicklertools", ru: "Инструменты Разработчика", ar: "أدوات المطور", zh: "开发者工具" },
    dev_level_simulator: { es: "Simulador de Nivel", fr: "Simulateur de Niveau", de: "Level-Simulator", ru: "Симулятор Уровня", ar: "محاكي المستوى", zh: "等级模拟器" },
    dev_tier_simulator: { es: "Simulador de Paquetes", fr: "Simulateur de Forfait", de: "Paket-Simulator", ru: "Симулятор Пакета", ar: "محاكي الحزم", zh: "套餐模拟器" },
    toast_level_updated: { es: "Nivel Actualizado", fr: "Niveau Mis à Jour", de: "Level aktualisiert", ru: "Уровень Обновлен", ar: "تم تحديث المستوى", zh: "等级已更新" },
    toast_tier_updated: { es: "Paquete Cambiado", fr: "Forfait Modifié", de: "Paket geändert", ru: "Пакет Изменен", ar: "تم تغيير الحزمة", zh: "套餐已更改" },
    please_login: { es: "Por favor, inicie sesión.", fr: "Veuillez vous connecter.", de: "Bitte einloggen.", ru: "Пожалуйста, войдите.", ar: "الرجاء تسجيل الدخول.", zh: "请登录。" }
  },
  AppLayout: {
    fallback_artist: { es: "Artista Anónimo", fr: "Artiste Anonyme", de: "Anonymer Künstler", ru: "Анонимный Художник", ar: "فنان مجهول", zh: "匿名艺术家" }
  },
  AdminPanel: {
    title: { es: "Bot de Contenido", fr: "Bot de Contenu", de: "Inhaltsbot", ru: "Бот Контента", ar: "روبوت المحتوى", zh: "内容机器人" },
    description: { es: "Genera lecciones con Gemini 2.0.", fr: "Génère des leçons avec Gemini 2.0.", de: "Erstellt Lektionen mit Gemini 2.0.", ru: "Создает уроки с Gemini 2.0.", ar: "يولد دروس مع Gemini 2.0.", zh: "使用Gemini 2.0生成课程。" },
    badge_active: { es: "ACTIVO", fr: "ACTIF", de: "AKTIV", ru: "АКТИВЕН", ar: "نشط", zh: "活跃" },
    label_level: { es: "Nivel", fr: "Niveau", de: "Level", ru: "Уровень", ar: "مستوى", zh: "等级" },
    label_category: { es: "Categoría", fr: "Catégorie", de: "Kategorie", ru: "Категория", ar: "فئة", zh: "类别" },
    placeholder_category: { es: "Selecciona...", fr: "Sélectionner...", de: "Auswählen...", ru: "Выбрать...", ar: "اختر...", zh: "选择..." },
    btn_generate_single: { es: "Generar Lección", fr: "Générer Leçon", de: "Lektion generieren", ru: "Создать урок", ar: "إنشاء درس", zh: "生成课程" },
    btn_generate_ten: { es: "Generar 10 Lecciones", fr: "Générer 10 Leçons", de: "10 Lektionen generieren", ru: "Создать 10 уроков", ar: "إنشاء 10 دروس", zh: "生成10个课程" },
    toast_select_category: { es: "Selecciona categoría primero.", fr: "Sélectionnez une catégorie.", de: "Kategorie zuerst auswählen.", ru: "Сначала выберите категорию.", ar: "اختر فئة أولا.", zh: "请先选择类别。" },
    toast_lesson_ready_title: { es: "Lección Lista", fr: "Leçon Prête", de: "Lektion bereit", ru: "Урок готов", ar: "الدرس جاهز", zh: "课程准备就绪" },
    toast_lesson_ready_desc: { es: "Pista visual en el laboratorio.", fr: "Indice dans le labo.", de: "Visueller Hinweis im Labor.", ru: "Визуальная подсказка в лаборатории.", ar: "التلميح المرئي في المختبر.", zh: "实验室中的视觉提示。" },
    toast_drafts_ready: { es: "Borradores Listos", fr: "Brouillons Prêts", de: "Entwürfe bereit", ru: "Черновики готовы", ar: "المسودات جاهزة", zh: "草稿准备就绪" },
    toast_success: { es: "¡Éxito!", fr: "Succès!", de: "Erfolg!", ru: "Успех!", ar: "نجاح!", zh: "成功！" },
    toast_lessons_published: { es: "publicado.", fr: "publié.", de: "veröffentlicht.", ru: "опубликовано.", ar: "تم النشر.", zh: "已发布。" },
    preview_title: { es: "Vista Previa", fr: "Aperçu", de: "Vorschau", ru: "Предпросмотр", ar: "معاينة", zh: "预览" },
    preview_clear: { es: "Limpiar", fr: "Effacer", de: "Leeren", ru: "Очистить", ar: "مسح", zh: "清除" },
    preview_publish_all: { es: "Publicar Todo", fr: "Tout Publier", de: "Alle veröffentlichen", ru: "Опубликовать все", ar: "نشر الكل", zh: "全部发布" },
    image_lab_title: { es: "Laboratorio de Imágenes", fr: "Laboratoire d'Images", de: "Bildlabor", ru: "Лаборатория Изображений", ar: "مختبر الصور", zh: "图像实验室" },
    image_lab_desc: { es: "Genera la imagen aquí.", fr: "Générez l'image ici.", de: "Bild hier generieren.", ru: "Сгенерируйте изображение здесь.", ar: "قم بإنشاء الصورة هنا.", zh: "在这里生成图像。" },
    btn_generate_image: { es: "Generar Imagen", fr: "Générer Image", de: "Bild generieren", ru: "Сгенерировать Изображение", ar: "إنشاء صورة", zh: "生成图像" },
    btn_save_folder: { es: "Solo Guardar", fr: "Enregistrer Seulement", de: "Nur Speichern", ru: "Только Сохранить", ar: "حفظ فقط", zh: "仅保存" },
    toast_image_generated: { es: "Imagen Generada", fr: "Image Générée", de: "Bild generiert", ru: "Изображение Сгенерировано", ar: "تم إنشاء الصورة", zh: "图像已生成" },
    toast_image_saved: { es: "Imagen Guardada", fr: "Image Sauvegardée", de: "Bild gespeichert", ru: "Изображение Сохранено", ar: "تم حفظ الصورة", zh: "图像已保存" },
    toast_image_missing: { es: "Falta imagen.", fr: "Image manquante.", de: "Bild fehlt.", ru: "Отсутствует изображение.", ar: "الصورة مفقودة.", zh: "图像丢失。" }
  }
};

const langs = ['es', 'fr', 'de', 'ru', 'ar', 'zh'];

for (const lang of langs) {
  const filePath = path.join(msgDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) continue;
  
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch(e) { continue; }
  
  for (const section in TRANSLATIONS) {
    if (!data[section]) data[section] = {};
    for (const key in TRANSLATIONS[section]) {
       if (TRANSLATIONS[section][key][lang]) {
         data[section][key] = TRANSLATIONS[section][key][lang];
       }
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

console.log('Tüm diller başarıyla senkronize edildi!');
