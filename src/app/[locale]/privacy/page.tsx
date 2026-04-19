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
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">3. Veri Güvenliği ve Saklama</h2>
          <p>
            Verileriniz, Google Cloud ve Firebase üzerindeki güvenli sunucularda saklanmaktadır. Fotoğraflarınız, siz silene kadar veya hesabınızı kapatana kadar "Private" (Gizli) statüsünde korunur. 
            Ancak, "Sergi" (Exhibition) veya "Yarışma" gibi bir topluluk alanına kendi rızanızla gönderdiğiniz fotoğraflar diğer kullanıcılar tarafından görülebilir.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">4. Haklarınız</h2>
          <p>
            KVKK ve GDPR uyarınca, verilerinize erişme, düzeltme, silme veya taşınmasını talep etme hakkına sahipsiniz. 
            Hesabınızı dilediğiniz zaman "Ayarlar" sekmesinden silebilir veya tüm verilerinizin silinmesi için bizimle iletişime geçebilirsiniz.
          </p>
        </section>

        <section className="space-y-4 bg-muted/30 p-6 rounded-[32px] border border-border/40">
          <h2 className="text-xl font-black uppercase tracking-tight">İletişim</h2>
          <p>Bu politika hakkında sorularınız için bize şu adresten ulaşabilirsiniz:</p>
          <p className="font-black text-primary">babacan.muharrem@gmail.com</p>
        </section>
      </div>
    </div>
  );
}
