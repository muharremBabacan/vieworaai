import fs from 'fs';
import path from 'path';

// 1. Add MasterAdmin keys to en.json
const enPath = path.join(process.cwd(), 'src/messages/en.json');
let enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));

enJson.MasterAdmin = {
  "unauthorized": "UNAUTHORIZED ACCESS",
  "visionary": "VISIONARY",
  "admin_panel": "Admin Panel",
  "tab_accounting": "Accounting",
  "tab_payments": "Payments",
  "tab_users": "Users",
  "tab_academy": "Academy",
  "tab_general": "General",
  "spent": "Spent",
  "recent_transactions": "Recent Transactions",
  "pending_payments": "Pending Payments",
  "user_management": "User Management",
  "search_user": "Search name or email...",
  "branding": "Branding",
  "currency_name": "Currency Name",
  "save": "Save",
  "edit_visionary": "Edit Visionary",
  "level_rank": "Level (Rank)",
  "pix_balance": "PIX Balance",
  "photo_analysis": "Photo Analysis",
  "save_changes": "Save Changes",
  "no_pending_payments": "No pending payments.",
  "action": "Action",
  "approve": "Approve",
  "manage": "Manage",
  "toast_payment_approved": "Payment Approved",
  "toast_error": "Error",
  "toast_saved": "Saved",
  "toast_user_updated": "User Updated",
  "package": "Package",
  "price": "Price"
};

fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2));

// 2. Add MasterAdmin keys to tr.json
const trPath = path.join(process.cwd(), 'src/messages/tr.json');
let trJson = JSON.parse(fs.readFileSync(trPath, 'utf8'));

trJson.MasterAdmin = {
  "unauthorized": "YETKİSİZ ERİŞİM",
  "visionary": "VİZYONER",
  "admin_panel": "Yönetici Paneli",
  "tab_accounting": "Muhasebe",
  "tab_payments": "Ödemeler",
  "tab_users": "Üyeler",
  "tab_academy": "Akademi",
  "tab_general": "Genel",
  "spent": "Harcanan",
  "recent_transactions": "Son İşlemler",
  "pending_payments": "Bekleyen Ödemeler",
  "user_management": "Üye Yönetimi",
  "search_user": "İsim veya e-posta ara...",
  "branding": "Markalama",
  "currency_name": "Para Birimi İsmi",
  "save": "Kaydet",
  "edit_visionary": "Vizyoner Düzenle",
  "level_rank": "Seviye (Rütbe)",
  "pix_balance": "PIX Bakiyesi",
  "photo_analysis": "Foto Analiz",
  "save_changes": "Değişiklikleri Kaydet",
  "no_pending_payments": "Bekleyen ödeme bulunmuyor.",
  "action": "İşlem",
  "approve": "Onayla",
  "manage": "Yönet",
  "toast_payment_approved": "Ödeme Onaylandı",
  "toast_error": "Hata",
  "toast_saved": "Kaydedildi",
  "toast_user_updated": "Kullanıcı Güncellendi",
  "package": "Paket",
  "price": "Fiyat"
};

fs.writeFileSync(trPath, JSON.stringify(trJson, null, 2));

// 3. Refactor admin-panel.tsx
const targetFile = path.join(process.cwd(), 'src/modules/admin/components/admin-panel.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

if (!content.includes("import { useTranslations }")) {
  content = content.replace(
    "import { useState, useMemo, useEffect } from 'react';",
    "import { useState, useMemo, useEffect } from 'react';\nimport { useTranslations } from 'next-intl';"
  );
}

content = content.replace(
  "export default function AdminPanel() {",
  "export default function AdminPanel() {\n  const t = useTranslations('MasterAdmin');"
);

// Toasts
content = content.replace('title: "Ödeme Onaylandı"', 'title: t("toast_payment_approved")');
content = content.replace('title: "Hata"', 'title: t("toast_error")');
content = content.replace('title: "Kaydedildi"', 'title: t("toast_saved")');
content = content.replace('title: "Kullanıcı Güncellendi"', 'title: t("toast_user_updated")');

// UI Strings
content = content.replace(">YETKİSİZ ERİŞİM<", ">{t('unauthorized')}<");
content = content.replace('} VİZYONER<', '} {t("visionary")}<');
content = content.replace(">Yönetici Paneli<", ">{t('admin_panel')}<");

content = content.replace(">Muhasebe<", ">{t('tab_accounting')}<");
content = content.replace(">Ödemeler<", ">{t('tab_payments')}<");
content = content.replace(">Üyeler<", ">{t('tab_users')}<");
content = content.replace(">Akademi<", ">{t('tab_academy')}<");
content = content.replace(">Genel<", ">{t('tab_general')}<");

content = content.replace(">Harcanan<", ">{t('spent')}<");
content = content.replace("> Son İşlemler<", "> {t('recent_transactions')}<");

content = content.replace("> Bekleyen Ödemeler<", "> {t('pending_payments')}<");
content = content.replace(">Vizyoner</TableHead>", ">{t('visionary')}</TableHead>");
content = content.replace(">Paket</TableHead>", ">{t('package')}</TableHead>");
content = content.replace(">Fiyat</TableHead>", ">{t('price')}</TableHead>");
content = content.replace(">İşlem</TableHead>", ">{t('action')}</TableHead>");
content = content.replace(">İşlem</TableHead>", ">{t('action')}</TableHead>"); // for second table
content = content.replace(">Onayla</Button>", ">{t('approve')}</Button>");
content = content.replace(">Bekleyen ödeme bulunmuyor.<", ">{t('no_pending_payments')}<");

content = content.replace("> Üye Yönetimi<", "> {t('user_management')}<");
content = content.replace('placeholder="İsim veya e-posta ara..."', 'placeholder={t("search_user")}');
content = content.replace(">Seviye</TableHead>", ">{t('level_rank')}</TableHead>");
content = content.replace(">Analiz (F/L)</TableHead>", ">{t('photo_analysis')} (F/L)</TableHead>");
content = content.replace("> Yönet</Button>", "> {t('manage')}</Button>");

content = content.replace("> Markalama<", "> {t('branding')}<");
content = content.replace(">Para Birimi İsmi</FormLabel>", ">{t('currency_name')}</FormLabel>");
content = content.replace(">Kaydet</Button>", ">{t('save')}</Button>");

// Sub Component UserEditDialog
content = content.replace(
  "function UserEditDialog({ userToEdit, isOpen, onClose, onUpdate",
  "function UserEditDialog({ userToEdit, isOpen, onClose, onUpdate"
);

// We need to inject t hook into UserEditDialog as well
content = content.replace(
  "const [isUpdating, setIsUpdating] = useState(false);",
  "const t = useTranslations('MasterAdmin');\n  const [isUpdating, setIsUpdating] = useState(false);"
);

content = content.replace(">Vizyoner Düzenle</DialogTitle>", ">{t('edit_visionary')}</DialogTitle>");
content = content.replace(">Seviye (Rütbe)</FormLabel>", ">{t('level_rank')}</FormLabel>");
content = content.replace(">PIX Bakiyesi</FormLabel>", ">{t('pix_balance')}</FormLabel>");
content = content.replace(">Foto Analiz</FormLabel>", ">{t('photo_analysis')}</FormLabel>");

content = content.replace('"{isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : "Değişiklikleri Kaydet"}"', "isUpdating ? <Loader2 className='animate-spin h-4 w-4' /> : t('save_changes')");

// Fix quotes issue in UserEditDialog button if I used hardcoded template literal
content = content.replace('isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : "Değişiklikleri Kaydet"', "isUpdating ? <Loader2 className=\"animate-spin h-4 w-4\" /> : t('save_changes')");

fs.writeFileSync(targetFile, content);
console.log("MasterAdmin panel successfully translated.");
