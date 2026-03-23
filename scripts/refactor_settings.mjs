import fs from 'fs';
import path from 'path';

const targetFile = path.join(process.cwd(), 'src/modules/settings/components/SettingsPage.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. Hook and Namespace updates
content = content.replace(
  "const t = useTranslations('ProfilePage');",
  "const t = useTranslations('SettingsPage');\n  const tApp = useTranslations('AppLayout');"
);

// 2. Pass `t` to DeveloperTools component since it doesn't have it natively
content = content.replace(
  "const DeveloperTools = ({",
  "const DeveloperTools = ({\n  const t = useTranslations('SettingsPage');"
);
// wait, we can't put a hook inside the arguments. Let's do it right inside the component block.
content = content.replace(
  "const DeveloperTools = ({ userProfile, user, firestore, toast }: { userProfile: User, user: any, firestore: any, toast: any }) => {\n",
  "const DeveloperTools = ({ userProfile, user, firestore, toast }: { userProfile: User, user: any, firestore: any, toast: any }) => {\n  const t = useTranslations('SettingsPage');\n"
);

// 3. Toasts
content = content.replaceAll('title: "Profil Güncellendi"', 'title: t("toast_profile_updated")');
content = content.replaceAll('title: "Hata"', 'title: t("toast_error")');
content = content.replaceAll('title: "Avatar Güncellendi"', 'title: t("toast_avatar_updated")');

// 4. Basic Layout
content = content.replace("Lütfen giriş yapın.", "{t('please_login')}");
content = content.replace("{t('title_settings') || 'Ayarlar'}", "{tApp('title_settings')}");

// 5. Labels & Forms
content = content.replace("Profil Ayarları", "{t('profile_settings')}");
content = content.replace("Takma Ad</Label>", "{t('nickname_label')}</Label>");
content = content.replace("> Telefon</Label>", "> {t('phone_label')}</Label>");
content = content.replace("> Instagram</Label>", "> {t('instagram_label')}</Label>");
content = content.replace(">Kaydet</Button>", ">{t('save_button')}</Button>");
content = content.replace("> Dil / Language</Label>", "> {t('language_label')}</Label>");
content = content.replace("Simge Seçin", "{t('select_avatar')}");

// 6. Gamification
content = content.replace("Rozet ve Seviye Rehberi", "{t('badge_guide_title')}");
content = content.replace(">Günlük Seri (Streak)</h4>", ">{t('streak_title')}</h4>");
content = content.replace(">Viewora'da kaç gün üst üste aktif olduğunuzu gösterir.</p>", ">{t('streak_desc')}</p>");
content = content.replace(">Rütbeler ve XP</h4>", ">{t('ranks_xp_title')}</h4>");

// 7. Developer tools & Account
content = content.replace("Uygulama & Hesap", "{t('app_and_account')}");
content = content.replace('title: "Seviye Güncellendi"', "title: t('toast_level_updated')");
content = content.replace(
  "title: `Paket Değişti: ${newTier.toUpperCase()}`", 
  "title: `${t('toast_tier_updated')}: ${newTier.toUpperCase()}`"
);
content = content.replace("Geliştirici Araçları", "{t('dev_tools_title')}");
content = content.replace(">Seviye Simülatörü</Label>", ">{t('dev_level_simulator')}</Label>");
content = content.replace('placeholder="Seviye seç..."', "placeholder={t('dev_level_simulator')}");
content = content.replace(">Paket Simülatörü</Label>", ">{t('dev_tier_simulator')}</Label>");

fs.writeFileSync(targetFile, content);
console.log("SettingsPage.tsx successfully translated.");
