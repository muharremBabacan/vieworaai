import type { User, Photo, Lesson, Package } from '@/types';
import { PlaceHolderImages } from './placeholder-images';

const findImage = (id: string) => PlaceHolderImages.find((img) => img.id === id);

export const user: User = {
  name: 'Alex Doe',
  email: 'alex.doe@example.com',
  avatarUrl: findImage('user-avatar')?.imageUrl ?? 'https://picsum.photos/seed/301/100/100',
  tokenBalance: 10,
  planLevel: 'Basic',
  xp: 0,
};

export const photos: Photo[] = [
  {
    id: '1',
    imageUrl: findImage('gallery-1')?.imageUrl ?? '',
    imageHint: findImage('gallery-1')?.imageHint ?? 'portrait',
    aiFeedback: {
      analysis: 'This is a strong portrait with dramatic lighting. The play of shadow and light on the subject\'s face creates a sense of depth and mystery. The composition is tight, focusing the viewer\'s attention effectively.',
      improvements: [
        'Experiment with a softer key light to create a different mood.',
        'Consider using a reflector to fill in some of the shadows for a less dramatic look.',
        'Try a different angle, perhaps from slightly below, to convey a sense of power.',
      ],
    },
    createdAt: '2023-10-26T10:00:00Z',
  },
  {
    id: '2',
    imageUrl: findImage('gallery-2')?.imageUrl ?? '',
    imageHint: findImage('gallery-2')?.imageHint ?? 'street photography',
    aiFeedback: null,
    createdAt: '2023-10-24T18:30:00Z',
  },
  {
    id: '3',
    imageUrl: findImage('gallery-3')?.imageUrl ?? '',
    imageHint: findImage('gallery-3')?.imageHint ?? 'nature forest',
    aiFeedback: null,
    createdAt: '2023-10-22T14:15:00Z',
  },
    {
    id: '4',
    imageUrl: findImage('gallery-4')?.imageUrl ?? '',
    imageHint: findImage('gallery-4')?.imageHint ?? 'abstract architecture',
    aiFeedback: null,
    createdAt: '2023-10-20T09:00:00Z',
  },
  {
    id: '5',
    imageUrl: findImage('gallery-5')?.imageUrl ?? '',
    imageHint: findImage('gallery-5')?.imageHint ?? 'black white',
    aiFeedback: {
      analysis: 'A powerful black and white landscape. The high contrast and stark composition create a raw and emotional image. The leading lines of the mountains guide the eye through the frame.',
      improvements: [
        'Try a longer exposure to smooth out the water and create a more ethereal feel.',
        'In post-processing, experiment with dodging and burning to enhance the contrast in specific areas.',
        'Explore different perspectives of this scene, perhaps a wider angle to include more of the sky.',
      ],
    },
    createdAt: '2023-10-18T12:45:00Z',
  },
    {
    id: '6',
    imageUrl: findImage('gallery-6')?.imageUrl ?? '',
    imageHint: findImage('gallery-6')?.imageHint ?? 'fashion portrait',
    aiFeedback: null,
    createdAt: '2023-10-15T16:20:00Z',
  },
];

export const lessons: Lesson[] = [
  {
    id: '1',
    category: 'Composition',
    title: 'The Rule of Thirds',
    content: 'Imagine your frame is divided into a 3x3 grid. Placing key elements along these lines or at their intersections creates more balanced and engaging photos.',
    imageUrl: findImage('academy-composition')?.imageUrl ?? '',
    imageHint: findImage('academy-composition')?.imageHint ?? 'rule thirds',
  },
  {
    id: '2',
    category: 'Lighting',
    title: 'Mastering Golden Hour',
    content: 'The period shortly after sunrise or before sunset is called the "golden hour." The soft, warm, diffused light is incredibly flattering for portraits and landscapes.',
    imageUrl: findImage('academy-light')?.imageUrl ?? '',
    imageHint: findImage('academy-light')?.imageHint ?? 'golden hour',
  },
  {
    id: '3',
    category: 'Technique',
    title: 'Exploring Long Exposure',
    content: 'Using a slow shutter speed can blur moving elements, creating dreamy effects with water, clouds, or city lights. A tripod is essential for this technique.',
    imageUrl: findImage('academy-technique')?.imageUrl ?? '',
    imageHint: findImage('academy-technique')?.imageHint ?? 'long exposure',
  },
];

export const packages: Package[] = [
  { id: '1', tokens: 20, price: 100, currency: 'TL', isBestValue: false },
  { id: '2', tokens: 50, price: 200, currency: 'TL', isBestValue: true },
  { id: '3', tokens: 150, price: 500, currency: 'TL', isBestValue: false },
];
