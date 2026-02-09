import type { User, Photo, Lesson, Package } from '@/types';
import { PlaceHolderImages } from './placeholder-images';

const findImage = (id: string) => PlaceHolderImages.find((img) => img.id === id);

export const user: User = {
  name: 'Ali Veli',
  email: 'ali.veli@example.com',
  avatarUrl: findImage('user-avatar')?.imageUrl ?? 'https://picsum.photos/seed/301/100/100',
  tokenBalance: 10,
  planLevel: 'Temel',
  xp: 0,
};

export const photos: Photo[] = [
  {
    id: '1',
    imageUrl: findImage('gallery-1')?.imageUrl ?? '',
    imageHint: findImage('gallery-1')?.imageHint ?? 'portre',
    aiFeedback: {
      analysis: 'Bu, dramatik ışıklandırmaya sahip güçlü bir portre. Konunun yüzündeki ışık ve gölge oyunu, derinlik ve gizem hissi yaratıyor. Kompozisyon sıkı, izleyicinin dikkatini etkili bir şekilde odaklıyor.',
      improvements: [
        'Farklı bir ruh hali yaratmak için daha yumuşak bir anahtar ışıkla denemeler yapın.',
        'Daha az dramatik bir görünüm için gölgelerin bir kısmını doldurmak amacıyla bir yansıtıcı kullanmayı düşünün.',
        'Güç hissi vermek için belki biraz aşağıdan farklı bir açı deneyin.',
      ],
      rating: {
        lighting: 9,
        composition: 8,
        emotion: 7,
        overall: 8,
      },
    },
    createdAt: '2023-10-26T10:00:00Z',
  },
  {
    id: '2',
    imageUrl: findImage('gallery-2')?.imageUrl ?? '',
    imageHint: findImage('gallery-2')?.imageHint ?? 'sokak fotoğrafçılığı',
    aiFeedback: null,
    createdAt: '2023-10-24T18:30:00Z',
  },
  {
    id: '3',
    imageUrl: findImage('gallery-3')?.imageUrl ?? '',
    imageHint: findImage('gallery-3')?.imageHint ?? 'doğa orman',
    aiFeedback: null,
    createdAt: '2023-10-22T14:15:00Z',
  },
    {
    id: '4',
    imageUrl: findImage('gallery-4')?.imageUrl ?? '',
    imageHint: findImage('gallery-4')?.imageHint ?? 'soyut mimari',
    aiFeedback: null,
    createdAt: '2023-10-20T09:00:00Z',
  },
  {
    id: '5',
    imageUrl: findImage('gallery-5')?.imageUrl ?? '',
    imageHint: findImage('gallery-5')?.imageHint ?? 'siyah beyaz',
    aiFeedback: {
      analysis: 'Güçlü bir siyah beyaz manzara. Yüksek kontrast ve sade kompozisyon, ham ve duygusal bir görüntü yaratıyor. Dağların öncü çizgileri, gözü çerçevenin içinden geçiriyor.',
      improvements: [
        'Suyu pürüzsüzleştirmek ve daha ruhani bir his yaratmak için daha uzun bir pozlama deneyin.',
        'Post-prodüksiyonda, belirli alanlardaki kontrastı artırmak için soldurma ve yakma (dodging and burning) ile denemeler yapın.',
        'Bu sahnenin farklı perspektiflerini keşfedin, belki gökyüzünü daha fazla dahil etmek için daha geniş bir açı kullanın.',
      ],
      rating: {
        lighting: 8,
        composition: 9,
        emotion: 8,
        overall: 8.5,
      },
    },
    createdAt: '2023-10-18T12:45:00Z',
  },
    {
    id: '6',
    imageUrl: findImage('gallery-6')?.imageUrl ?? '',
    imageHint: findImage('gallery-6')?.imageHint ?? 'moda portre',
    aiFeedback: null,
    createdAt: '2023-10-15T16:20:00Z',
  },
];

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
  { id: '1', tokens: 20, price: 100, currency: 'TL', isBestValue: false },
  { id: '2', tokens: 50, price: 200, currency: 'TL', isBestValue: true },
  { id: '3', tokens: 150, price: 500, currency: 'TL', isBestValue: false },
];
