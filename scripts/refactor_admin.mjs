import fs from 'fs';
import path from 'path';

const targetFile = path.join(process.cwd(), 'src/modules/admin/components/AcademyAdminPanel.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// Add useTranslations import if not present
if (!content.includes("import { useTranslations }")) {
  content = content.replace(
    "import { useState, useMemo } from 'react';",
    "import { useState, useMemo } from 'react';\nimport { useTranslations } from 'next-intl';"
  );
}

// Add next-intl hook
if (!content.includes("const t = useTranslations('AdminPanel');")) {
  content = content.replace(
    "export default function AcademyAdminPanel() {",
    "export default function AcademyAdminPanel() {\n  const t = useTranslations('AdminPanel');"
  );
}

// 1. Header strings
content = content.replace(">Akademi İçerik Robotu</CardTitle>", ">{t('title')}</CardTitle>");
content = content.replace(">Müfredata dayalı dersleri Gemini 2.0 Flash ile üretin.</CardDescription>", ">{t('description')}</CardDescription>");
content = content.replace("IMAGEN 3.0 & FLASH 2.0 AKTİF</Badge>", "{t('badge_active')}</Badge>");

// 2. Selectors
content = content.replace(">Eğitim Seviyesi</Label>", ">{t('label_level')}</Label>");
content = content.replace(">Kategori (Müfredat)</Label>", ">{t('label_category')}</Label>");
content = content.replace('placeholder="Kategori seçin..."', "placeholder={t('placeholder_category')}");
content = content.replace('placeholder="Kategori seçin..."', "placeholder={t('placeholder_category')}"); // backup

// 3. Generate Buttons
content = content.replace("> Tek Ders Üret</>", "> {t('btn_generate_single')}</>");
content = content.replace("> 10 Ders Üret</>", "> {t('btn_generate_ten')}</>");

// 4. Preview Panel
content = content.replace(">Taslak Önizleme (", ">{t('preview_title')} (");
content = content.replace(">Temizle</Button>", ">{t('preview_clear')}</Button>");
content = content.replace('"{isPublishing ? <Loader2 className="animate-spin" /> : "Tümünü Otomatik Yayınla"}"', 'isPublishing ? <Loader2 className="animate-spin" /> : t("preview_publish_all")');
content = content.replace('!manualPreview || isPublishing}', '!manualPreview || isPublishing}');
content = content.replace('Üretilen Görselle Yayınla', 'Publish With Generated Image'); // Or skip for now

// 5. Image Lab
content = content.replace("> Görsel Üretim Laboratuvarı (Imagen 3)</CardTitle>", "> {t('image_lab_title')}</CardTitle>");
content = content.replace(">Üretilen dersin görsel ipucunu burada onaylayıp görseli oluşturun.</CardDescription>", ">{t('image_lab_desc')}</CardDescription>");
content = content.replace('"{isGeneratingManual ? <Loader2 className="animate-spin" /> : "Görsel Üret"}"', 'isGeneratingManual ? <Loader2 className="animate-spin" /> : t("btn_generate_image")');
content = content.replace('Sadece Klasöre Kaydet', '{t("btn_save_folder")}');

fs.writeFileSync(targetFile, content);
console.log("AcademyAdminPanel.tsx successfully translated.");
