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
  GroupDetailPage: {
    purpose_study: { es: "Estudio", fr: "Étude", de: "Lernen", ru: "Учеба", ar: "دراسة", zh: "学习", ja: "勉強" },
    purpose_challenge: { es: "Desafío", fr: "Défi", de: "Herausforderung", ru: "Челлендж", ar: "تحدي", zh: "挑战", ja: "チャレンジ" },
    purpose_walk: { es: "Paseo Fotográfico", fr: "Promenade Photo", de: "Fotospaziergang", ru: "Фотопрогулка", ar: "جولة تصوير", zh: "摄影漫步", ja: "フォトウォーク" },
    purpose_mentor: { es: "Mentor", fr: "Mentor", de: "Mentor", ru: "Наставник", ar: "مرشد", zh: "导师", ja: "メンター" },
    anonymous_artist: { es: "Artista", fr: "Artiste", de: "Künstler", ru: "Художник", ar: "فنان", zh: "艺术家", ja: "アーティスト" },
    label_meeting_details: { es: "DETALLES DE LA REUNIÓN", fr: "DÉTAILS DE LA RÉUNION", de: "TREFFPUNKTDETAILS", ru: "ДЕТАЛИ ВСТРЕЧИ", ar: "تفاصيل الاجتماع", zh: "会议详情", ja: "会議の詳細" },
    label_meeting_point: { es: "PUNTO DE ENCUENTRO", fr: "POINT DE RENCONTRE", de: "TREFFPUNKT", ru: "МЕСТО ВСТРЕЧИ", ar: "نقطة التقاء", zh: "会合地点", ja: "集合場所" },
    toast_analyzing: { es: "Analizando...", fr: "Analyse en cours...", de: "Analysieren...", ru: "Анализ...", ar: "جارٍ التحليل...", zh: "正在分析...", ja: "分析中..." },
    button_open_route: { es: "ABRIR RUTA", fr: "OUVRIR LA ROUTE", de: "ROUTE ÖFFNEN", ru: "ОТКРЫТЬ МАРШРУТ", ar: "فتح المسار", zh: "打开路线", ja: "ルートを開く" },
    template_galata_title: { es: "Ruta Arquitectónica Galata - Karaköy", fr: "Route Architecturale Galata - Karaköy", de: "Galata - Karaköy Architekturroute", ru: "Архитектурный маршрут Галата - Каракей", ar: "مسار غالاتا - كاراكوي المعماري", zh: "加拉塔 - 卡拉柯伊建筑路线", ja: "ガラタ・カラキョイ建築ルート" },
    template_balat_title: { es: "Calles Coloridas de Balat", fr: "Rues Colorées de Balat", de: "Bunte Straßen von Balat", ru: "Цветные улицы Балата", ar: "شوارع بلات الملونة", zh: "巴拉特多彩街道", ja: "バラットのカラフルな街並み" }
  },
  AcademyLevelPage: {
    practice_submission_title: { es: "Muestra tu Práctica", fr: "Montre ta Pratique", de: "Zeig deine Praxis", ru: "Покажи свою практику", ar: "أظهر ممارستك", zh: "展示你的练习", ja: "実戦を見せる" },
    practice_submission_description: { es: "Sube la foto que tomaste para esta tarea y obtén comentarios instantáneos.", fr: "Télécharge la photo que tu as prise pour ce devoir et obtiens un retour instantané.", de: "Lade das Foto hoch, das du für diese Aufgabe gemacht hast, und erhalte sofortiges Feedback.", ru: "Загрузите фотографию, которую вы сделали для этого задания, и получите мгновенный отзыв.", ar: "قم بتحميل الصورة التي التقطتها لهذا التكليف واحصل على ملاحظات فورية.", zh: "上传你为该任务拍摄的照片，即可获得即时反馈。", ja: "この課題のために撮った写真をアップロードして、すぐにフィードバックを受け取りましょう。" },
    toast_file_size_title: { es: "Archivo Demasiado Grande", fr: "Fichier Trop Volumineux", de: "Datei zu groß", ru: "Файл слишком большой", ar: "حجم الملف كبير جداً", zh: "文件太大", ja: "ファイルサイズが大きすぎます" },
    toast_analysis_start_title: { es: "Iniciando Análisis...", fr: "Analyse en Cours...", de: "Analyse wird gestartet...", ru: "Начало анализа...", ar: "بدء التحليل...", zh: "开始分析...", ja: "分析を開始しています..." },
    toast_feedback_ready_title: { es: "¡Comentarios Listos!", fr: "Retour Prêt !", de: "Feedback bereit!", ru: "Отзыв готов!", ar: "الملاحظات جاهزة!", zh: "反馈已准备就绪！", ja: "フィードバックの準備ができました！" },
    toast_analysis_fail_title: { es: "Análisis Fallido", fr: "Analyse Échouée", de: "Analyse fehlgeschlagen", ru: "Ошибка анализа", ar: "فشل التحليل", zh: "分析失败", ja: "分析に失敗しました" },
    score: { es: "Puntuación: {score}/10", fr: "Score : {score}/10", de: "Punktzahl: {score}/10", ru: "Баллы: {score}/10", ar: "النتيجة: {score}/10", zh: "评分：{score}/10", ja: "スコア: {score}/10" },
    button_new_photo: { es: "Subir Nueva Foto", fr: "Télécharger une Nouvelle Photo", de: "Neues Foto hochladen", ru: "Загрузить новое фото", ar: "تحميل صورة جديدة", zh: "上传新照片", ja: "新しい写真をアップロード" },
    upload_prompt_click: { es: "Haz clic para subir", fr: "Cliquez pour télécharger", de: "Zum Hochladen klicken", ru: "Нажмите для загрузки", ar: "انقر للتحميل", zh: "点击上传", ja: "クリックしてアップロード" },
    upload_prompt_drag: { es: "o arrastra y suelta", fr: "ou glisser-déposer", de: "oder per Drag & Drop", ru: "или перетащите", ar: "أو سحب وإفلات", zh: "或拖放", ja: "またはドラッグ＆ドロップ" },
    button_evaluating: { es: "Evaluando...", fr: "Évaluation...", de: "Bewertung...", ru: "Оценка...", ar: "جاري التقييم...", zh: "评估中...", ja: "評価中..." },
    button_get_feedback: { es: "Obtener Comentarios", fr: "Obtenir un Retour", de: "Feedback erhalten", ru: "Получить отзыв", ar: "احصل على ملاحظات", zh: "获取反馈", ja: "フィードバックを受け取る" },
    dialog_objective: { es: "Objetivo de Aprendizaje", fr: "Objectif d'Apprentissage", de: "Lernziel", ru: "Цель обучения", ar: "هدف التعلم", zh: "学习目标", ja: "学習目標" },
    dialog_theory: { es: "Teoría", fr: "Théorie", de: "Theorie", ru: "Теория", ar: "نظري", zh: "理论", ja: "理論" },
    dialog_criteria: { es: "Criterios de Éxito", fr: "Critères de Réussite", de: "Erfolgskriterien", ru: "Критерии успеха", ar: "معايير النجاح", zh: "成功标准", ja: "成功基準" },
    dialog_task: { es: "Tarea Práctica", fr: "Tâche Pratique", de: "Praktische Aufgabe", ru: "Практическое задание", ar: "مهمة عملية", zh: "实践任务", ja: "実戦課題" },
    dialog_auro_note: { es: "Nota de Auro", fr: "Note d'Auro", de: "Auro Notiz", ru: "Заметка Auro", ar: "ملاحظة أورو", zh: "Auro 笔记", ja: "Auro ノート" },
    button_completed: { es: "Completado", fr: "Terminé", de: "Abgeschlossen", ru: "Завершено", ar: "مكتمل", zh: "已完成", ja: "完了" },
    button_complete_lesson: { es: "Completar Lección (+{xp} XP, +{auro} Auro)", fr: "Terminer la Leçon (+{xp} XP, +{auro} Auro)", de: "Lektion abschließen (+{xp} XP, +{auro} Auro)", ru: "Завершить урок (+{xp} XP, +{auro} Auro)", ar: "إكمال الدرس (+{xp} XP, +{auro} Auro)", zh: "完成课程 (+{xp} XP, +{auro} Auro)", ja: "レッスンを完了 (+{xp} XP, +{auro} Auro)" },
    toast_reward_title: { es: "¡Recompensa Ganada!", fr: "Récompense Gagnée !", de: "Belohnung verdient!", ru: "Награда получена!", ar: "تم الحصول على مكافأة!", zh: "获得奖励！", ja: "報酬を獲得しました！" },
    toast_reward_description: { es: "Has ganado {xp} XP y {auro} Auro en esta lección.", fr: "Tu as gagné {xp} XP et {auro} Auro dans cette leçon.", de: "Du hast {xp} XP und {auro} Auro in dieser Lektion verdient.", ru: "Вы получили {xp} XP и {auro} Auro за этот урок.", ar: "لقد ربحت {xp} XP و {auro} Auro من هذا الدرس.", zh: "你在这节课中获得了 {xp} XP 和 {auro} Auro。", ja: "このレッスンで {xp} XP と {auro} Auro を獲得しました。" },
    toast_level_up_title: { es: "¡Has Subido de Nivel!", fr: "Niveau Supérieur !", de: "Level Up!", ru: "Уровень повышен!", ar: "ارتفع مستواك!", zh: "等级提升！", ja: "レベルアップ！" },
    no_lessons_title: { es: "No hay lecciones en este nivel aún", fr: "Pas encore de leçons à ce niveau", de: "Noch keine Lektionen auf diesem Level", ru: "На этом уровне пока нет уроков", ar: "لا توجد دروس في هذا المستوى بعد", zh: "此级别尚无课程", ja: "このレベルにはまだレッスンがありません" },
    button_back_to_academy: { es: "Volver a la Academia", fr: "Retour à l'Académie", de: "Zurück zur Akademie", ru: "Назад в Академию", ar: "العودة إلى الأكاديمية", zh: "返回学院", ja: "アカデミーに戻る" },
    page_title_suffix: { es: "Lecciones de Nivel", fr: "Leçons de Niveau", de: "Level-Lektionen", ru: "Уроки уровня", ar: "دروس المستوى", zh: "级别课程", ja: "レベルのレッスン" },
    category_other: { es: "Otros", fr: "Autres", de: "Andere", ru: "Другое", ar: "آخر", zh: "其他", ja: "その他" }
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

const langs = ['es', 'fr', 'de', 'ru', 'ar', 'zh', 'ja'];

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
