'use client';
export const dynamic = 'force-dynamic';
import { Link } from '@/i18n/navigation';
import Logo from '@/core/components/logo';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto max-w-3xl py-12 space-y-8">
      <div className="text-center">
        <Link href="/login">
            <Logo className="mx-auto mb-4 justify-center" />
        </Link>
      </div>
      <h1 className="text-4xl font-black tracking-tighter text-center uppercase">Hizmet Şartları</h1>
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
            Viewora platformuna hoş geldiniz. Hizmetlerimizi kullanarak, aşağıdaki şartları kabul etmiş sayılırsınız. 
            Lütfen bu metni dikkatlice okuyun.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">1. Hizmetin Tanımı</h2>
          <p>
            Viewora, fotoğrafçılara yapay zeka destekli teknik analiz, eğitim (Akademi) ve topluluk odaklı etkileşim (Yarışmalar, Sergiler) sunan bir platformdur. 
            Sunulan analizler tavsiye niteliğindedir ve sanatsal gelişiminize rehberlik etmeyi amaçlar.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">2. Kullanıcı Sorumlulukları ve Hesap Güvenliği</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Giriş yapmak için Google hesabınızı kullanırken, hesabınızın güvenliğinden siz sorumlusunuz.</li>
            <li>Platforma yüklediğiniz tüm içeriklerin (fotoğraflar, yorumlar) yasal haklarına sahip olduğunuzu taahhüt edersiniz.</li>
            <li>Başkalarına ait, telif hakkı ihlali içeren veya topluluk kurallarımıza aykırı (müstehcen, şiddet içeren vb.) içeriklerin yüklenmesi yasaktır.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">3. "Pix" Sistemi ve Ödemeler</h2>
          <p>
            Viewora, belirli işlemler (AI Analizi, Yarışma Katılımı vb.) için "Pix" adı verilen bir kredi sistemi kullanır. 
            Pix'ler uygulama içi satın alımlar veya kazanılan ödüller yoluyla elde edilir. Dijital bir varlık olan Pix'ler, aksi belirtilmedikçe nakde çevrilemez veya iade edilemez.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">4. Fikri Mülkiyet ve Lisans</h2>
          <p>
            Yüklediğiniz tüm fotoğrafların fikri mülkiyeti size aittir. Viewora, bu içerikleri size hizmet sunmak (AI analizi yapmak, profilinizde sergilemek) ve platformu iyileştirmek amacıyla kullanmak için dünya çapında, münhasır olmayan bir lisansa sahip olur.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">5. Hesap Feshi (Termination)</h2>
          <p>
            Platform kurallarına uymayan, etik dışı içerik paylaşan veya sistem güvenliğini tehdit eden kullanıcıların hesapları, 
            Viewora tarafından önceden bildirim yapılmaksızın askıya alınabilir veya kalıcı olarak kapatılabilir.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight border-b border-border/40 pb-2">6. Yapay Zeka (AI) Çıktıları ve Sorumluluk Sınırı</h2>
          <p>
            Viewora ve Yapay Zeka Koçu Luma tarafından sunulan grafik ve analizlerin %100 doğruluğu garanti edilmez. 
            Analiz sonuçlarından doğabilecek sanatsal veya ticari kararlardan platform sorumlu tutulamaz.
          </p>
        </section>

        <section className="space-y-4 bg-muted/30 p-6 rounded-[32px] border border-border/40">
          <h2 className="text-xl font-black uppercase tracking-tight">İletişim</h2>
          <p>Şartlar hakkında sorularınız için:</p>
          <p className="font-black text-primary">babacan.muharrem@gmail.com</p>
        </section>
      </div>
    </div>
  );
}
