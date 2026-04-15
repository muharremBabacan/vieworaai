
import type { Package } from '@/types';

export const packages: Package[] = [
  {
    id: 'starter',
    name: 'Starter Paket',
    target: 'Meraklılar',
    slogan: 'Hızlı başla, ışığı yakala.',
    pix: 20,
    price: 99.00,
    currency: 'TL',
    isBestValue: false,
  },
  {
    id: 'creator',
    name: 'Creator Paket',
    target: 'Gelişenler',
    slogan: 'Detaylara odaklan, fark yarat.',
    pix: 50,
    price: 199.00,
    currency: 'TL',
    isBestValue: true,
  },
  {
    id: 'pro',
    name: 'Pro Paket',
    target: 'Tutkunlar/Ustalar',
    slogan: 'Sınırları aş, efsaneye dönüş.',
    pix: 100,
    price: 349.00,
    currency: 'TL',
    isBestValue: false,
  },
];
