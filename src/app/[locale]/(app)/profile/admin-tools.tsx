'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { generateStrategicFeedback, type StrategicFeedbackOutput } from '@/ai/flows/generate-strategic-feedback';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import userProfileIndex from '@/lib/test_user_1.json';

export function AdminTools() {
    const t = useTranslations('ProfilePage');
    const { toast } = useToast();
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<StrategicFeedbackOutput | null>(null);

    const handleGenerate = async () => {
        if (!prompt) {
            toast({
                variant: 'destructive',
                title: t('admin_toast_missing_selection_title'),
                description: "Lütfen bir prompt girin."
            });
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const feedbackResult = await generateStrategicFeedback({ 
                userPrompt: prompt,
                userProfileIndex: userProfileIndex as any // Cast since we're using a static JSON file
            });
            setResult(feedbackResult);
        } catch (error) {
            console.error("Strategic feedback generation failed:", error);
            toast({
                variant: 'destructive',
                title: t('admin_toast_generate_error_title'),
                description: "Stratejik geri bildirim üretilirken bir hata oluştu."
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="border-amber-500/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-amber-500" />
                    {t('admin_tools_title')}
                </CardTitle>
                <CardDescription>{t('admin_tools_description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2 p-4 border rounded-lg">
                    <h4 className="font-semibold">{t('admin_strategic_feedback_title')}</h4>
                    <p className="text-sm text-muted-foreground">
                        {t('admin_strategic_feedback_description')}
                    </p>
                    <div className="space-y-2 pt-2">
                        <Label htmlFor="strategic-prompt">{t('admin_prompt_label')}</Label>
                        <Textarea
                            id="strategic-prompt"
                            placeholder="e.g., Analyze my recent work and suggest a weekend project."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <Button onClick={handleGenerate} disabled={isLoading}>
                        {isLoading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('admin_button_generating')}</>
                        ) : (
                            <>{t('admin_button_get_feedback')}</>
                        )}
                    </Button>
                </div>

                {(isLoading || result) && (
                     <div className="space-y-2 p-4 border rounded-lg bg-background/50">
                        <h4 className="font-semibold flex items-center gap-2">
                           <Bot className="h-5 w-5" />
                           {t('admin_response_label')}
                        </h4>
                        {isLoading ? (
                             <div className="space-y-2 pt-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-full mt-4" />
                            </div>
                        ) : result ? (
                             <div className="text-sm text-muted-foreground space-y-4 pt-2 whitespace-pre-wrap">
                                <div>
                                    <p className="font-semibold text-foreground mb-1">Feedback:</p>
                                    <p>{result.feedback}</p>
                                </div>
                                <div className="font-mono bg-muted p-2 rounded-md">
                                    <p className="font-semibold text-foreground mb-1">Action Task:</p>
                                    <p><strong>{result.actionTask.title}</strong></p>
                                    <ul className="list-disc pl-5 mt-1">
                                        {result.actionTask.steps.map((step, i) => <li key={i}>{step}</li>)}
                                    </ul>
                                    <p className="mt-2"><strong className="text-foreground">Metric:</strong> {result.actionTask.metric}</p>
                                    <p><strong className="text-foreground">Difficulty:</strong> {result.actionTask.difficulty}/5</p>
                                </div>
                            </div>
                        ) : null}
                     </div>
                )}
            </CardContent>
        </Card>
    );
}
