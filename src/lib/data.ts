import type { Package, Competition } from '@/types';
import { PlaceHolderImages } from './placeholder-images';

const findImage = (id: string) => PlaceHolderImages.find((img) => img.id === id);

export const packages: Package[] = [
  {
    id: '1',
    name: 'Snap Paket',
    target: 'Meraklılar',
    slogan: 'Hızlı başla, ışığı yakala.',
    auro: 20,
    price: 99.99,
    currency: 'TL',
    isBestValue: false,
  },
  {
    id: '2',
    name: 'Focus Paket',
    target: 'Gelişenler',
    slogan: 'Detaylara odaklan, fark yarat.',
    auro: 60,
    price: 269.99,
    currency: 'TL',
    isBestValue: true,
  },
  {
    id: '3',
    name: 'Burst Paket',
    target: 'Tutkunlar/Ustalar',
    slogan: 'Sınırları aş, efsaneye dönüş.',
    auro: 150,
    price: 599.99,
    currency: 'TL',
    isBestValue: false,
  },
];

export const competitions: Competition[] = [
    {
        id: '1',
        title: 'Gecenin Işıkları',
        description: 'Şehrinizin gece manzarasını yakalayın. Neon ışıklar, ışık izleri ve mimari aydınlatmalarla yaratıcılığınızı gösterin.',
        theme: 'Gece Fotoğrafçılığı',
        prize: '150 Auro + Ana Sayfada Sergilenme',
        startDate: '2024-08-01T00:00:00Z',
        endDate: '2024-08-31T23:59:59Z',
        imageUrl: findImage('gallery-2')?.imageUrl ?? '',
        imageHint: 'sokak fotoğrafçılığı gece',
    },
    {
        id: '2',
        title: 'Doğanın Portresi',
        description: 'Doğanın ham güzelliğini ve sakinliğini yansıtan en iyi manzara fotoğrafınızı gönderin. Dağlar, ormanlar, denizler...',
        theme: 'Manzara',
        prize: '150 Auro + Ana Sayfada Sergilenme',
        startDate: '2024-09-01T00:00:00Z',
        endDate: '2024-09-30T23:59:59Z',
        imageUrl: findImage('gallery-3')?.imageUrl ?? '',
        imageHint: 'doğa orman',
    }
];
