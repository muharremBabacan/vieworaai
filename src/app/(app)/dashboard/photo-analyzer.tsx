'use client';

import { useState, useRef, useTransition, ChangeEvent, DragEvent } from 'react';
import Image from 'next/image';
import { analyzePhotoAndSuggestImprovements } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import type { AnalyzePhotoAndSuggestImprovementsOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UploadCloud, X, Loader2, Lightbulb, LayoutPanelLeft, Heart, Zap } from 'lucide-react';
import { user } from '@/lib/data';

function AnalysisResult({ result }: { result: AnalyzePhotoAndSuggestImprovementsOutput }) {
  const improvements = [
    { icon: Lightbulb, color: 'text-yellow-500' },
    { icon: LayoutPanelLeft, color: 'text-blue-500' },
    { icon: Heart, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="font-headline text-xl font-semibold mb-4">AI Analysis</h3>
          <p className="text-muted-foreground">{result.analysis}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <h3 className="font-headline text-xl font-semibold mb-4">Improvement Tips</h3>
          <ul className="space-y-4">
            {result.improvements.map((tip, index) => {
              const Icon = improvements[index % improvements.length].icon;
              const color = improvements[index % improvements.length].color;
              return (
                <li key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Icon className={cn('h-6 w-6', color)} />
                  </div>
                  <p className="text-muted-foreground">{tip}</p>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PhotoAnalyzer() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzePhotoAndSuggestImprovementsOutput | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setResult(null);
    } else if (selectedFile) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please upload an image file (e.g., JPG, PNG).',
      });
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleAnalyze = () => {
    if (!file || !preview) return;
    if (user.tokenBalance < 1) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Tokens',
        description: 'You need at least 1 token to analyze a photo.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const analysisResult = await analyzePhotoAndSuggestImprovements({
          photoDataUri: preview,
        });
        setResult(analysisResult);
        // Here you would typically update the user's token balance in the database
        user.tokenBalance -= 1; 
      } catch (error) {
        console.error('Analysis failed:', error);
        toast({
          variant: 'destructive',
          title: 'Analysis Failed',
          description: 'Something went wrong. Please try again later.',
        });
      }
    });
  };

  const handleClear = () => {
    setPreview(null);
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8">
      {!preview && (
        <div
          className={cn(
            'relative w-full h-80 rounded-lg border-2 border-dashed border-muted-foreground/50 transition-colors duration-200 flex flex-col justify-center items-center text-center cursor-pointer hover:border-primary hover:bg-accent',
            isDragging && 'border-primary bg-accent'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            className="hidden"
            accept="image/*"
          />
          <div className="space-y-4">
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              <span className="font-semibold text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
          </div>
        </div>
      )}

      {preview && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video">
              <Image src={preview} alt="Preview" fill className="object-contain" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-4 right-4 h-8 w-8 rounded-full"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6">
              <Button onClick={handleAnalyze} disabled={isPending || user.tokenBalance < 1} className="w-full" size="lg">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Analyze Photo (1 Token)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isPending && (
         <div className="space-y-6">
          <Card><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
        </div>
      )}

      {result && <AnalysisResult result={result} />}
    </div>
  );
}

function Skeleton({className}: {className?: string}) {
  return <div className={cn("animate-pulse rounded-md bg-muted/50", className)} />;
}
