import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Logo from '@/components/logo';
import { ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const heroImage = PlaceHolderImages.find((img) => img.id === 'landing-hero');

  return (
    <div className="flex flex-col min-h-screen">
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Logo />
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <div className="relative isolate h-full">
          {heroImage && (
            <Image
              src={heroImage.imageUrl}
              alt={heroImage.description}
              fill
              className="object-cover -z-10"
              data-ai-hint={heroImage.imageHint}
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent -z-10" />

          <div className="mx-auto max-w-2xl h-full flex flex-col justify-end pb-24 sm:pb-32 lg:pb-40">
            <div className="text-center">
              <h1 className="font-headline text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Unlock Your Artistic Vision
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-300">
                Viewora is your personal AI photography coach. Get expert feedback on your photos to refine your technique and elevate your art.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Get Started <ArrowRight className="ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
