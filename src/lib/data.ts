import type { Package } from '@/types';
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
