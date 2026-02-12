import type { Lesson, Package, Competition } from '@/types';
import { PlaceHolderImages } from './placeholder-images';

const findImage = (id: string) => PlaceHolderImages.find((img) => img.id === id);

export const lessons: Lesson[] = [
  {
    id: '1',
    category: 'Kompozisyon',
    title: 'Üçler Kuralı',
    content: 'Karenizin 3x3\'lük bir ızgaraya bölündüğünü hayal edin. Anahtar unsurları bu çizgiler boyunca veya kesişim noktalarına yerleştirmek, daha dengeli ve ilgi çekici fotoğraflar oluşturur.',
    imageUrl: findImage('academy-composition')?.imageUrl ?? '',
    imageHint: findImage('academy-composition')?.imageHint ?? 'üçler kuralı',
  },
  {
    id: '2',
    category: 'Işık',
    title: 'Altın Saatte Ustalaşma',
    content: 'Gündoğumundan hemen sonraki veya günbatımından hemen önceki dönem "altın saat" olarak adlandırılır. Yumuşak, sıcak, dağınık ışık, portreler ve manzaralar için inanılmaz derecede gurur okşayıcıdır.',
    imageUrl: findImage('academy-light')?.imageUrl ?? '',
    imageHint: findImage('academy-light')?.imageHint ?? 'altın saat',
  },
  {
    id: '3',
    category: 'Teknik',
    title: 'Uzun Pozlamayı Keşfetme',
    content: 'Yavaş bir enstantane hızı kullanmak, hareketli öğeleri bulanıklaştırarak su, bulutlar veya şehir ışıkları ile rüya gibi efektler yaratabilir. Bu teknik için bir tripod şarttır.',
    imageUrl: findImage('academy-technique')?.imageUrl ?? '',
    imageHint: findImage('academy-technique')?.imageHint ?? 'uzun pozlama',
  },
];

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
