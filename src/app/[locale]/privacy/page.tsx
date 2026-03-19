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
      <h1 className="text-3xl font-bold text-center">Gizlilik Politikası</h1>
      <p className="text-sm text-muted-foreground text-center">Son güncelleme: 24 Temmuz 2024</p>
      
      <div className="text-center">
        <Button variant="outline" asChild>
            <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Giriş Sayfasına Dön
            </Link>
        </Button>
      </div>

      <div className="space-y-6 text-foreground/80 leading-relaxed">
        <p><strong>Bu belge geçici bir yer tutucudur. Lütfen yasal gerekliliklerinizi karşılayan kendi Gizlilik Politikanız ile değiştirin.</strong></p>

        <p>Gizliliğiniz bizim için önemlidir. Viewora'nın politikası, web sitemiz https://viewora.ai ve sahip olduğumuz ve işlettiğimiz diğer siteler aracılığıyla sizden toplayabileceğimiz her türlü bilgiye ilişkin gizliliğinize saygı duymaktır.</p>
        <p>Kişisel bilgileri yalnızca size bir hizmet sunmak için gerçekten ihtiyaç duyduğumuzda adil ve yasal yollarla, bilginiz ve rızanız dahilinde toplarız. Ayrıca neden topladığımızı ve nasıl kullanılacağını da size bildiririz.</p>
        
        <h2 className="text-2xl font-semibold pt-4">Topladığımız Bilgiler</h2>
        <p>Uygulamamızı kullandığınızda, kimlik doğrulama için e-posta adresiniz, adınız ve Google tarafından sağlanan profil resminiz gibi temel hesap bilgilerinizi toplarız. Ayrıca, hizmeti sağlamak amacıyla yüklediğiniz fotoğrafları ve onboarding sırasında seçtiğiniz ilgi alanları gibi gönüllü olarak sağladığınız bilgileri de saklarız.</p>
        
        <h2 className="text-2xl font-semibold pt-4">Bilgilerin Kullanımı</h2>
        <p>Topladığımız bilgileri, size hizmetlerimizi sunmak, sürdürmek, korumak ve iyileştirmek, yeni hizmetler geliştirmek ve Viewora'yı ve kullanıcılarımızı korumak için kullanırız. Yüklediğiniz fotoğraflar, yalnızca sizin talep ettiğiniz yapay zeka analizlerini gerçekleştirmek için kullanılır ve izniniz olmadan herkese açık olarak paylaşılmaz.</p>

        <h2 className="text-2xl font-semibold pt-4">Bizimle İletişime Geçin</h2>
        <p>Bu Gizlilik Politikası hakkında herhangi bir sorunuz varsa, bizimle iletişime geçebilirsiniz.</p>
      </div>
    </div>
  );
}
