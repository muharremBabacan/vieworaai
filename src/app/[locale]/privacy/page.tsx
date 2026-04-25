'use client';
export const dynamic = 'force-dynamic';
import { Link } from '@/i18n/navigation';
import Logo from '@/core/components/logo';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-3xl py-12 space-y-8">
      <div className="text-center">
        <Link href="/login">
            <Logo className="mx-auto mb-4 justify-center" />
        </Link>
      </div>
      <h1 className="text-4xl font-black tracking-tighter text-center uppercase">Gizlilik Politikası</h1>
      <p className="text-xs font-bold text-muted-foreground text-center uppercase tracking-widest">Son güncelleme: 19 Nisan 2026</p>
      
      <div className="text-center">
        <Button variant="outline" asChild className="rounded-2xl font-bold">
            <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Giriş Sayfasına Dön
            </Link>
        </Button>
      </div>

      <div className="space-y-8 text-foreground/90 leading-relaxed font-medium">
        <section className="space-y-4">
          <p>
            Viewora ("biz", "bizim" veya "platform"), gizliliğinize saygı duyar ve kişisel verilerinizin güvenliğini ciddiye alır. 
            Bu Gizlilik Politikası, web sitemiz (https://viewora.ai) ve uygulamamız aracılığıyla toplayabileceğimiz bilgilerin nasıl işlendiğini açıklar.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">1. Topladığımız Bilgiler</h2>
          <p>Hizmetlerimizi sunabilmek için aşağıdaki veri türlerini topluyoruz:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Google Hesap Bilgileri:</strong> Google ile giriş yaptığınızda e-posta adresiniz, adınız-soyadınız ve profil resminiz kimlik doğrulama amacıyla alınır.</li>
            <li><strong>Görsel Veriler:</strong> Analiz edilmek üzere yüklediğiniz fotoğraflar, yapay zeka (Luma) tarafından taranmak ve size geri bildirim sunmak amacıyla geçici ve kalıcı olarak saklanır.</li>
            <li><strong>Kullanım Verileri:</strong> Uygulama içi tercihleriniz, onboarding sırasında verdiğiniz yanıtlar ve platform üzerindeki aktiviteleriniz deneyiminizi kişiselleştirmek için kaydedilir.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">2. Verilerin Kullanım Amacı</h2>
          <p>Topladığımız veriler şu amaçlarla kullanılır:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Gelişmiş Yapay Zeka (AI) fotoğraf analizi ve teknik raporlama sağlamak.</li>
            <li>Hesap yönetiminizi gerçekleştirmek ve "Pix" bakiyenizi takip etmek.</li>
            <li>Akademi ve Yarışma süreçlerinde ilerlemenizi kaydetmek.</li>
            <li>Platform güvenliğini sağlamak ve Google OAuth politikalarına uyum sağlamak.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">3. Google Kullanıcı Verileri ve Sınırlı Kullanım</h2>
          <p>
            Viewora'nın Google API'lerinden alınan bilgileri kullanımı ve başka bir uygulamaya aktarımı, 
            <a href="https://developers.google.com/terms/api-services-user-data-policy#limited-use-requirements" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google API Hizmetleri Kullanıcı Verileri Politikası</a>'na (Sınırlı Kullanım gereksinimleri dahil) uygundur.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Google verileriniz (e-posta, ad-soyad) asla reklam amaçlı kullanılmaz ve üçüncü taraf veri havuzlarına satılmaz.</li>
            <li>Bu veriler sadece Viewora üzerinde oturum açmanız ve size özel bir profil oluşturulması için kullanılır.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">4. Veri Saklama ve Silme (Hakkınızda Bilgi Silme)</h2>
          <p>
            Verileriniz, hesabınız aktif olduğu sürece güvenle saklanır. Verilerinizin silinmesini şu yollarla talep edebilirsiniz:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Otomatik Silme:</strong> Profil ayarlarınızdan "Hesabımı Sil" seçeneğini kullanarak tüm kişisel verilerinizi anında sistemden silebilirsiniz.</li>
            <li><strong>Manuel Talep:</strong> Silme talebinizi e-posta yoluyla iletebilirsiniz. Talebiniz 30 gün içinde işleme alınır.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">5. Çocukların Gizliliği</h2>
          <p>
            Viewora, 13 yaşın altındaki çocuklardan bilerek kişisel bilgi toplamaz. Eğer 13 yaşından küçük bir çocuğun bize bilgi verdiğini fark ederseniz, lütfen iletişime geçin.
          </p>
        </section>

        <section className="space-y-4 bg-muted/30 p-6 rounded-[32px] border border-border/40">
          <h2 className="text-xl font-black uppercase tracking-tight">İletişim</h2>
          <p>Bu politika veya veri silme talepleriniz için bize ulaşın:</p>
          <p className="font-black text-primary">babacan.muharrem@gmail.com</p>
        </section>
      </div>
    </div>
  );
}
