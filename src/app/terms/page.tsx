'use client';
export const dynamic = 'force-dynamic';
import { Link } from '@/navigation';
import Logo from '@/core/components/logo';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto max-w-3xl py-12 space-y-8">
      <div className="text-center">
        <Link href="/">
            <Logo className="mx-auto mb-4 justify-center" />
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-center">Hizmet Şartları</h1>
      <p className="text-sm text-muted-foreground text-center">Son güncelleme: 24 Temmuz 2024</p>

      <div className="text-center">
        <Button variant="outline" asChild>
            <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Giriş Sayfasına Dön
            </Link>
        </Button>
      </div>

      <div className="space-y-6 text-foreground/80 leading-relaxed">
        <p><strong>Bu belge geçici bir yer tutucudur. Lütfen yasal gerekliliklerinizi karşılayan kendi Hizmet Şartlarınız ile değiştirin.</strong></p>

        <p>Hizmetimizi kullanmadan önce lütfen bu şartları ve koşulları dikkatlice okuyun.</p>
        
        <h2 className="text-2xl font-semibold pt-4">1. Şartların Kabulü</h2>
        <p>Hizmetimizi kullanarak ("Servis"), bu Şartlara bağlı kalmayı kabul edersiniz. Şartların herhangi bir bölümüne katılmıyorsanız, Hizmete erişemeyebilirsiniz.</p>
        
        <h2 className="text-2xl font-semibold pt-4">2. Hesaplar</h2>
        <p>Bizde bir hesap oluşturduğunuzda, bize her zaman doğru, eksiksiz ve güncel bilgiler vermelisiniz. Bunu yapmamanız, Şartların ihlali anlamına gelir ve Hizmetimizdeki hesabınızın derhal feshedilmesine neden olabilir. Hesabınız altında gerçekleşen herhangi bir etkinlikten siz sorumlusunuz.</p>

        <h2 className="text-2xl font-semibold pt-4">3. Fikri Mülkiyet</h2>
        <p>Hizmet ve orijinal içeriği, özellikleri ve işlevselliği Viewora'nın ve lisans verenlerinin münhasır mülkiyetindedir ve öyle kalacaktır. Yüklediğiniz fotoğraflar ve içeriklerin mülkiyeti size aittir, ancak bize hizmeti sunmak, tanıtmak ve iyileştirmek için dünya çapında, münhasır olmayan, telifsiz bir lisans vermiş olursunuz.</p>

        <h2 className="text-2xl font-semibold pt-4">Bizimle İletişime Geçin</h2>
        <p>Bu Şartlar hakkında herhangi bir sorunuz varsa, bizimle iletişime geçebilirsiniz.</p>
      </div>
    </div>
  );
}
