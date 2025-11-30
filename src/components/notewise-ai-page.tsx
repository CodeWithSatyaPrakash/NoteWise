'use client';

import { useState, useRef, ChangeEvent, useEffect, FormEvent } from 'react';
import {
  UploadCloud,
  FileText,
  HelpCircle,
  MessageSquare,
  Volume2,
  Loader2,
  BookOpen,
  X,
  Send,
  RefreshCw,
  Sparkles,
  Clipboard,
  Lightbulb,
  Copy,
  ChevronLeft,
  ChevronRight,
  PenSquare,
  Sun,
  Moon,
  StopCircle,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import { useTheme } from 'next-themes';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import VaporizeTextCycle, { Tag } from '@/components/ui/vapour-text-effect';
import { SplashScreen } from '@/components/splash-screen';

import { pdfUploadAndSummarize } from '@/ai/flows/pdf-upload-and-summarize';
import { extractTextFromPdf } from '@/ai/flows/extract-text-from-pdf';
import { generateMcqQuiz } from '@/ai/flows/generate-mcq-quiz';
import { realTimeAIInteraction } from '@/ai/flows/real-time-ai-interaction';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { generateFlashcards, GenerateFlashcardsOutput } from '@/ai/flows/generate-flashcards';
import { generateSmartNotes } from '@/ai/flows/generate-smart-notes';
import { SparklesCore } from './ui/sparkles';

type QuizItem = {
  question: string;
  options: string[];
  answer: string;
  topic: string;
};

type QnaMessage = {
  role: 'user' | 'ai';
  content: string;
};

type Flashcard = GenerateFlashcardsOutput['flashcards'][0];

type FeatureDialog = 'summary' | 'quiz' | 'qna' | 'flashcards' | 'smart-notes' | null;

const isOverloadedError = (e: any) => {
    return e instanceof Error && (e.message.includes('503') || e.message.toLowerCase().includes('overloaded') || e.message.toLowerCase().includes('request body is too large'));
}

export function NoteWiseAIPage() {
  const [showUploader, setShowUploader] = useState(false);
  const { setTheme, theme } = useTheme();
  const { toast } = useToast();
  const [pdfText, setPdfText] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing PDF...');
  const [fileName, setFileName] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [numQuestions, setNumQuestions] = useState<number | ''>(5);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [quizDuration, setQuizDuration] = useState<number | null>(null);
  const [reviewTopics, setReviewTopics] = useState<string[]>([]);

  const [qnaMessages, setQnaMessages] = useState<QnaMessage[]>([]);
  const [isQnaLoading, setIsQnaLoading] = useState(false);
  const qnaInputRef = useRef<HTMLInputElement>(null);

  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [flashcards, setFlashcards] = useState<Flashcard[] | null>(null);
  const [isFlashcardLoading, setIsFlashcardLoading] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  const [smartNotes, setSmartNotes] = useState<string | null>(null);
  const [isSmartNotesLoading, setIsSmartNotesLoading] = useState(false);
  const [noteLength, setNoteLength] = useState<'short' | 'long'>('short');

  const [activeDialog, setActiveDialog] = useState<FeatureDialog>(null);

  useEffect(() => {
    if (quiz && quizScore === null) {
      setQuizStartTime(Date.now());
    }
  }, [quiz, quizScore]);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const onEnded = () => setIsTtsPlaying(false);
      audio.addEventListener('ended', onEnded);
      return () => {
        audio.removeEventListener('ended', onEnded);
      };
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setLoadingMessage('Reading your PDF...');
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const pdfDataUri = reader.result as string;
      if (!pdfDataUri) {
          toast({ variant: 'destructive', title: 'File Read Error', description: 'Could not read the file. It might be corrupted or in a format the browser cannot process.' });
          handleReset();
          return;
      }
      try {
        setLoadingMessage('Extracting text...');
        const result = await extractTextFromPdf({ pdfDataUri });
        setPdfText(result.pdfText);
      } catch (e) {
        if (isOverloadedError(e)) {
            toast({ variant: 'destructive', title: 'AI is Busy', description: 'The AI model is currently overloaded. Please try again in a moment.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to process PDF. Please try a different file.' });
        }
        console.error(e);
        handleReset();
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      toast({ variant: 'destructive', title: 'File Read Error', description: 'Could not read file. This may be a browser issue. Try another browser or a different PDF.' });
      handleReset();
    };
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a PDF file.' });
        return;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast({ variant: 'destructive', title: 'File Too Large', description: 'Please upload a PDF smaller than 50MB.' });
        return;
      }
      handleFileUpload(file);
    }
  };

  const handleOpenSummary = async () => {
    setActiveDialog('summary');
    if (summary || !pdfText) return;
    setIsSummaryLoading(true);
    try {
      const result = await pdfUploadAndSummarize({ pdfText });
      setSummary(result.summary);
    } catch (e) {
      if (isOverloadedError(e)) {
          toast({ variant: 'destructive', title: 'AI is Busy', description: 'The AI model is currently overloaded. Please try again in a moment.' });
      } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate summary.' });
      }
      console.error(e);
    } finally {
      setIsSummaryLoading(false);
    }
  };
  
  const handleGenerateQuiz = async () => {
    if (!pdfText) return;
    const questions = Number(numQuestions);
    if (questions < 1 || questions > 20) {
      toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please enter a number of questions between 1 and 20.' });
      return;
    }
    setIsQuizLoading(true);
    setQuiz(null);
    setUserAnswers({});
    setQuizScore(null);
    setQuizDuration(null);
    setReviewTopics([]);
    try {
      const result = await generateMcqQuiz({ pdfText: pdfText, numberOfQuestions: questions });
      setQuiz(result.quiz);
    } catch (e) {
      if (isOverloadedError(e)) {
        toast({ variant: 'destructive', title: 'AI is Busy', description: 'The AI model is currently overloaded. Please try again in a moment.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not generate quiz. Please try again.' });
      }
      console.error(e);
    } finally {
      setIsQuizLoading(false);
    }
  };
  
  const handleGenerateFlashcards = async () => {
    if (!pdfText) return;
    setIsFlashcardLoading(true);
    setFlashcards(null);
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
    try {
      const result = await generateFlashcards({ pdfText: pdfText });
      setFlashcards(result.flashcards);
    } catch (e) {
      if (isOverloadedError(e)) {
        toast({ variant: 'destructive', title: 'AI is Busy', description: 'The AI model is currently overloaded. Please try again in a moment.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not generate flashcards. Please try again.' });
      }
      console.error(e);
    } finally {
      setIsFlashcardLoading(false);
    }
  };
  
  const handleGenerateSmartNotes = async () => {
    if (!pdfText) return;
    setIsSmartNotesLoading(true);
    setSmartNotes(null);
    try {
      const result = await generateSmartNotes({ pdfText: pdfText, noteLength });
      setSmartNotes(result.notes);
    } catch (e) {
      if (isOverloadedError(e)) {
        toast({ variant: 'destructive', title: 'AI is Busy', description: 'The AI model is currently overloaded. Please try again in a moment.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not generate notes. Please try again.' });
      }
      console.error(e);
    } finally {
      setIsSmartNotesLoading(false);
    }
  };
  
  const handleDownloadNotes = () => {
    if (!smartNotes) return;

    const blob = new Blob([smartNotes], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-notes-${noteLength}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Success', description: 'Notes downloaded successfully.' });
  };

  const handleCopyNotes = () => {
    if (!smartNotes) return;
    navigator.clipboard.writeText(smartNotes).then(() => {
        toast({ title: 'Success', description: 'Notes copied to clipboard.' });
    }, (err) => {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to copy notes.' });
        console.error('Could not copy text: ', err);
    });
  };


  const handleAskQuestion = async () => {
    if (!pdfText || !qnaInputRef.current?.value.trim()) return;
    const question = qnaInputRef.current.value;
    qnaInputRef.current.value = '';
    
    const newMessages: QnaMessage[] = [...qnaMessages, { role: 'user', content: question }];
    setQnaMessages(newMessages);
    setIsQnaLoading(true);

    try {
      const result = await realTimeAIInteraction({ pdfContent: pdfText, userInput: question, history: qnaMessages });
      setQnaMessages([...newMessages, { role: 'ai', content: result.aiResponse }]);
    } catch (e) {
      if (isOverloadedError(e)) {
         setQnaMessages([...newMessages, { role: 'ai', content: "Sorry, the AI is a bit busy right now. Please try again in a moment." }]);
      } else {
        setQnaMessages([...newMessages, { role: 'ai', content: "Sorry, I ran into an error. Please try again." }]);
      }
      console.error(e);
    } finally {
      setIsQnaLoading(false);
    }
  };

  const handleTextToSpeech = async (text: string) => {
    if (isTtsPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsTtsPlaying(false);
      return;
    }

    setIsTtsLoading(true);
    try {
      const result = await textToSpeech(text);
      if (audioRef.current) {
        audioRef.current.src = result.media;
        audioRef.current.play();
        setIsTtsPlaying(true);
      }
    } catch (e) {
       if (isOverloadedError(e)) {
        toast({ variant: 'destructive', title: 'AI is Busy', description: 'Text-to-speech is currently unavailable. Please try again in a moment.' });
       } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Text-to-speech failed.' });
       }
      console.error(e);
    } finally {
      setIsTtsLoading(false);
    }
  };

  const handleStopTts = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsTtsPlaying(false);
    }
  };
  
  const handleReset = () => {
    setPdfText(null);
    setSummary(null);
    setIsLoading(false);
    setFileName(null);
    setQuiz(null);
    setQnaMessages([]);
    setUserAnswers({});
    setQuizScore(null);
    setQuizDuration(null);
    setQuizStartTime(null);
    setNumQuestions(5);
    setReviewTopics([]);
    setActiveDialog(null);
    setFlashcards(null);
    setSmartNotes(null);
    setShowUploader(true); // Go back to uploader
    handleStopTts();
  };
  
  const handleSubmitQuiz = (e: FormEvent) => {
    e.preventDefault();
    if (!quiz || !quizStartTime) return;
    const endTime = Date.now();
    setQuizDuration(Math.round((endTime - quizStartTime) / 1000));
    let score = 0;
    const incorrectTopics = new Set<string>();
    quiz.forEach((q, i) => {
      if (userAnswers[i] === q.answer) {
        score++;
      } else {
        incorrectTopics.add(q.topic);
      }
    });
    setQuizScore(score);
    setReviewTopics(Array.from(incorrectTopics));
    toast({
      title: 'Quiz Submitted!',
      description: `You scored ${score} out of ${quiz.length}.`,
    });
  };
  
  const handleFlashcardNav = (direction: 'prev' | 'next') => {
    setIsCardFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex(prev => {
        if (direction === 'next') {
          return (prev + 1) % (flashcards?.length || 1);
        } else {
          return (prev - 1 + (flashcards?.length || 1)) % (flashcards?.length || 1);
        }
      });
    }, 150);
  };

  const Uploader = () => (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background animated-grid"></div>
      
      <div className="mb-8">
        <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit border-8 border-primary/20 mb-4 animate-pulse">
          <BookOpen className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Upload Your Document</h1>
        <p className="text-lg text-muted-foreground mt-2">Let AI accelerate your learning journey.</p>
      </div>

      <label htmlFor="file-upload" className="relative block w-full max-w-lg cursor-pointer">
        <div className="p-8 rounded-2xl bg-muted/50 border-2 border-dashed border-border transition-all duration-300 hover:border-primary hover:bg-muted/80 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-full group-hover:animate-bounce">
              <UploadCloud className="h-12 w-12 text-primary" />
            </div>
            <p className="text-xl font-semibold">Drop PDF Here (Scanned / Handwritten)</p>
            <p className="text-muted-foreground">or click to browse your files</p>
          </div>
        </div>
        <input id="file-upload" type="file" className="sr-only" accept="application/pdf" onChange={handleFileChange} />
      </label>
      <p className="text-xs text-muted-foreground mt-6">Max file size: 50MB. We promise to keep your data safe.</p>
    </div>
  );

    const FeatureHub = () => {
    const features = [
      { icon: Sparkles, title: 'AI Summary', onClick: handleOpenSummary },
      { icon: MessageSquare, title: 'Talk to PDF', onClick: () => setActiveDialog('qna') },
      { icon: HelpCircle, title: 'Generate Quiz', onClick: () => setActiveDialog('quiz') },
      { icon: PenSquare, title: 'Smart Notes', onClick: () => setActiveDialog('smart-notes') },
      { icon: Copy, title: 'Flashcards', onClick: () => setActiveDialog('flashcards') },
    ];

    const containerRef = useRef<HTMLDivElement>(null);
    const [radius, setRadius] = useState(240);

    useEffect(() => {
        const updateRadius = () => {
          if (containerRef.current) {
            const size = Math.min(containerRef.current.offsetWidth, containerRef.current.offsetHeight);
            const isMobile = window.innerWidth < 768;
            setRadius(isMobile ? size / 3 : size / 2.5);
          }
        };

        updateRadius();
        window.addEventListener('resize', updateRadius);
        return () => window.removeEventListener('resize', updateRadius);
    }, []);

    return (
      <div ref={containerRef} className="relative flex h-full w-full items-center justify-center">
        <AnimatePresence>
          {features.map((feature, i) => {
            const angle = (i / features.length) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <motion.div
                key={feature.title}
                className="absolute"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  x: x,
                  y: y,
                  transition: {
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                    delay: 0.5 + i * 0.1,
                  },
                }}
                exit={{ opacity: 0, scale: 0 }}
                whileHover={{ scale: 1.1, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.95 }}
              >
                <button
                  onClick={feature.onClick}
                  className="group flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-full border-2 border-primary/20 bg-card/80 text-center shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-primary hover:shadow-primary/20"
                >
                  <feature.icon className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                  <span className="text-xs font-semibold">{feature.title}</span>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <motion.div
          className="z-10 flex flex-col items-center justify-center rounded-full p-4 text-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1, transition: { delay: 0.2 } }}
        >
          <div className="relative">
            <div className="absolute -inset-2 animate-pulse rounded-full bg-primary/30 blur-xl" />
            <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 border-primary bg-background text-center">
              <Lightbulb className="h-8 w-8 text-primary" />
              <h2 className="mt-2 text-lg font-bold">Doc Received!</h2>
            </div>
          </div>
          <p className="mt-3 max-w-xs truncate text-sm text-muted-foreground">{fileName}</p>
        </motion.div>
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <Loader2 className="w-16 h-16 animate-spin text-primary mb-8" />
          <div className="h-12 flex items-center justify-center">
            <VaporizeTextCycle
              texts={["Extracting text...", "Analyzing content...", "Almost there..."]}
              font={{
                fontFamily: "Inter, sans-serif",
                fontSize: "24px",
                fontWeight: 600,
              }}
              color={`hsl(var(--foreground))`}
              spread={1}
              density={5}
              animation={{
                vaporizeDuration: 1.5,
                fadeInDuration: 0.8,
                waitDuration: 1,
              }}
              direction="left-to-right"
              alignment="center"
              tag={Tag.P}
            />
          </div>
          <p className="text-muted-foreground mt-2">{fileName}</p>
        </div>
      );
    }
    
    if (showUploader && !pdfText) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            <Uploader />
          </div>
        )
    }
    
    if(!showUploader && !pdfText) {
        return <SplashScreen onGetStarted={() => setShowUploader(true)} />;
    }

    return null;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-background-start to-background-end relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full -z-10">
         <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.2}
          maxSize={0.8}
          particleDensity={40}
          className="w-full h-full"
          particleColor="hsl(var(--primary))"
          speed={0.5}
          direction="bottom"
        />
      </div>

      <div className="absolute top-0 left-0 w-full h-full">
        {pdfText ? (
          <main className="w-full h-full">
              <FeatureHub />
          </main>
        ) : (
          <div className="flex-1 flex flex-col h-full">{renderContent()}</div>
        )}
      </div>

      <header className="absolute top-0 z-50 flex items-center justify-end h-16 px-4 w-full">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          {pdfText && (
              <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Start Over
              </Button>
          )}
        </div>
      </header>

      <footer className="absolute bottom-0 w-full text-center p-4 text-sm text-muted-foreground">
        Designed & engineered by Satya. Have feedback or need help? <a href="mailto:satyaprakashmohanty97@gmail.com" className="underline hover:text-primary">Contact me</a>.
      </footer>
      
      {/* Dialog for AI Summary */}
      <Dialog open={activeDialog === 'summary'} onOpenChange={(v) => { if (!v) { setActiveDialog(null); handleStopTts(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="text-primary"/> AI Summary</DialogTitle>
            <DialogDescription>Key points from your document.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-64 pr-4">
             {isSummaryLoading && <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
            {summary && <p className="text-sm">{summary}</p>}
          </ScrollArea>
          <DialogFooter className="gap-2 sm:justify-start">
             {isTtsPlaying ? (
                 <Button variant="destructive" size="sm" onClick={handleStopTts}>
                    <StopCircle className="w-4 h-4 mr-2" />
                    Stop
                 </Button>
             ) : (
                <Button variant="outline" size="sm" onClick={() => summary && handleTextToSpeech(summary)} disabled={isTtsLoading || isSummaryLoading || !summary}>
                    {isTtsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
                    Listen
                </Button>
             )}
             <Button variant="ghost" size="sm" onClick={() => summary && navigator.clipboard.writeText(summary)} disabled={!summary}>
                <Clipboard className="w-4 h-4 mr-2" /> Copy
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog for Quiz */}
      <Dialog open={activeDialog === 'quiz'} onOpenChange={(v) => !v && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Multiple Choice Quiz</DialogTitle>
            <DialogDescription>Test your knowledge based on the document summary.</DialogDescription>
          </DialogHeader>
          
          {!quiz && !isQuizLoading && quizScore === null && (
            <div className="flex flex-col items-center gap-4 py-8">
                <Label htmlFor="num-questions">Number of Questions</Label>
                <Input id="num-questions" type="number" value={numQuestions} onChange={(e) => setNumQuestions(e.target.value === '' ? '' : parseInt(e.target.value, 10))} min="1" max="20" placeholder="e.g., 5" className="w-48"/>
                <Button type="button" onClick={handleGenerateQuiz} disabled={isQuizLoading || !numQuestions} className="w-48">
                  {isQuizLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generate Quiz
                </Button>
            </div>
          )}

          {isQuizLoading && <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
          
          {quiz && quizScore === null && (
            <form onSubmit={handleSubmitQuiz}>
              <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {quiz.map((q, i) => (
                  <div key={i}>
                    <p className="font-semibold mb-2">{i + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, j) => (
                        <Button type="button" key={j} variant="outline" className={cn("w-full justify-start text-left h-auto py-2", userAnswers[i] === opt && "border-primary border-2")}
                          onClick={() => setUserAnswers(prev => ({...prev, [i]: opt}))}
                          >
                          {opt}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              </ScrollArea>
               <DialogFooter className="mt-4">
                 <Button type="submit" disabled={Object.keys(userAnswers).length !== quiz.length}>
                  Submit Quiz
                 </Button>
               </DialogFooter>
            </form>
          )}

          {quizScore !== null && quiz && (
            <div>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="p-4 bg-muted rounded-lg text-center mb-4">
                  <p className="text-lg font-bold">Your Score: {quizScore}/{quiz.length}</p>
                  {quizDuration !== null && <p className="text-sm text-muted-foreground">Completed in {quizDuration} seconds</p>}
                  {reviewTopics.length > 0 && (
                    <div className="mt-4 text-left">
                      <p className="font-bold">Topics to review:</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {reviewTopics.map((topic, i) => <li key={i}>{topic}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {quiz.map((q, i) => (
                    <div key={i}>
                      <p className="font-semibold mb-2">{i + 1}. {q.question}</p>
                      <div className="space-y-2">
                        {q.options.map((opt, j) => {
                          const isSelected = userAnswers[i] === opt;
                          const isCorrect = q.answer === opt;
                          return (
                            <div key={j} className={cn("w-full text-left h-auto py-2 px-4 rounded border", 
                              isCorrect ? "bg-green-500/20 border-green-500" : (isSelected ? "bg-red-500/20 border-red-500" : "bg-muted")
                            )}>
                              {opt}
                            </div>
                          )
                        })}
                      </div>
                       {userAnswers[i] !== q.answer && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertDescription>
                            Correct Answer: {q.answer}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <DialogFooter className="mt-4">
                 <Button onClick={handleGenerateQuiz} variant="secondary" type="button">
                     <RefreshCw className="w-4 h-4 mr-2"/>
                     Regenerate Quiz
                 </Button>
                 <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                 </DialogClose>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Dialog for Q&A */}
      <Dialog open={activeDialog === 'qna'} onOpenChange={(v) => !v && setActiveDialog(null)}>
        <DialogContent className="h-[80vh] flex flex-col sm:max-w-lg">
          <DialogHeader>
             <DialogTitle className="flex items-center gap-2"><MessageSquare className="text-primary"/> Interactive Q&A</DialogTitle>
            <DialogDescription>Ask questions and get answers from the PDF content.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {qnaMessages.length === 0 && <div className="text-center text-muted-foreground p-8">Ask a question to start the conversation.</div>}
                {qnaMessages.map((msg, i) => (
                  <div key={i} className={cn("flex items-start gap-3", msg.role === 'user' ? 'justify-end' : '')}>
                    {msg.role === 'ai' && <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5 text-primary"/></div>}
                    <div className={cn("p-3 rounded-lg max-w-[80%]", msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isQnaLoading && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5 text-primary"/></div>
                    <div className="p-3 rounded-lg bg-muted flex items-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
             <div className="flex w-full items-center space-x-2">
               <Input ref={qnaInputRef} placeholder="Ask a question..." onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}/>
               <Button onClick={handleAskQuestion} disabled={isQnaLoading}><Send className="w-4 h-4"/></Button>
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog for Flashcards */}
      <Dialog open={activeDialog === 'flashcards'} onOpenChange={(v) => !v && setActiveDialog(null)}>
          <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><Copy className="text-primary"/> Flashcard Generator</DialogTitle>
                  <DialogDescription>Review key concepts with generated flashcards.</DialogDescription>
              </DialogHeader>
              
              {!flashcards && !isFlashcardLoading && (
                  <div className="flex flex-col items-center gap-4 py-8">
                      <p className="text-center text-muted-foreground">Generate flashcards based on the document's summary.</p>
                      <Button onClick={handleGenerateFlashcards} disabled={isFlashcardLoading}>
                          {isFlashcardLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                          Generate Flashcards
                      </Button>
                  </div>
              )}

              {isFlashcardLoading && <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}

              {flashcards && (
                  <div>
                      <div className="relative h-64 w-full cursor-pointer" style={{ perspective: '1000px' }} onClick={() => setIsCardFlipped(!isCardFlipped)}>
                          <div className={cn("absolute h-full w-full rounded-lg shadow-lg transition-transform duration-500", isCardFlipped ? '[transform:rotateY(180deg)]' : '')} style={{ transformStyle: 'preserve-3d' }}>
                              {/* Front */}
                              <div className="absolute h-full w-full flex items-center justify-center p-6 bg-card border rounded-lg" style={{ backfaceVisibility: 'hidden' }}>
                                  <p className="text-center text-lg font-semibold">{flashcards[currentCardIndex].front}</p>
                              </div>
                              {/* Back */}
                              <div className="absolute h-full w-full flex items-center justify-center p-6 bg-card border rounded-lg" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                                  <p className="text-center">{flashcards[currentCardIndex].back}</p>
                              </div>
                          </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                          <Button variant="outline" size="icon" onClick={() => handleFlashcardNav('prev')}><ChevronLeft /></Button>
                          <p className="text-sm text-muted-foreground">{currentCardIndex + 1} / {flashcards.length}</p>
                          <Button variant="outline" size="icon" onClick={() => handleFlashcardNav('next')}><ChevronRight /></Button>
                      </div>
                  </div>
              )}
               {flashcards && (
                 <DialogFooter className="mt-4">
                     <Button onClick={handleGenerateFlashcards} variant="secondary">
                         <RefreshCw className="w-4 h-4 mr-2" />
                         Regenerate
                     </Button>
                 </DialogFooter>
               )}
          </DialogContent>
      </Dialog>
      
       {/* Dialog for Smart Notes */}
      <Dialog open={activeDialog === 'smart-notes'} onOpenChange={(v) => !v && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PenSquare className="text-primary"/> Smart Study Notes</DialogTitle>
            <DialogDescription>Your structured study notes, ready for review.</DialogDescription>
          </DialogHeader>
          
          {isSmartNotesLoading && <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
          
          {!isSmartNotesLoading && !smartNotes && (
              <div className="flex flex-col items-center gap-4 py-8">
                  <p className="text-center text-muted-foreground">Generate structured notes from the document's summary.</p>
                  <RadioGroup value={noteLength} className="flex gap-4" onValueChange={(value: 'short' | 'long') => setNoteLength(value)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="short" id="short" />
                        <Label htmlFor="short">Short Notes (UG/Revision)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="long" id="long" />
                        <Label htmlFor="long">Long Notes (PhD/Detailed)</Label>
                      </div>
                  </RadioGroup>
                  <Button onClick={handleGenerateSmartNotes} disabled={isSmartNotesLoading} className="mt-4">
                      {isSmartNotesLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Generate Notes
                  </Button>
              </div>
          )}
          
          {smartNotes && (
            <>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{smartNotes}</ReactMarkdown>
                </div>
              </ScrollArea>
              <DialogFooter className="gap-2 sm:justify-start mt-4">
                 <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                    <RadioGroup value={noteLength} className="flex gap-4" onValueChange={(value: 'short' | 'long') => setNoteLength(value)}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="short" id="short-regen" />
                            <Label htmlFor="short-regen">Short</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="long" id="long-regen" />
                            <Label htmlFor="long-regen">Long</Label>                          </div>
                      </RadioGroup>
                      <div className="flex gap-2 sm:ml-auto">
                        <Button variant="ghost" size="sm" onClick={handleCopyNotes}>
                            <Clipboard className="w-4 h-4 mr-2" /> Copy
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleDownloadNotes}>
                            <Download className="w-4 h-4 mr-2" /> Download
                        </Button>
                        <Button onClick={handleGenerateSmartNotes} variant="secondary" size="sm" disabled={isSmartNotesLoading}>
                            {isSmartNotesLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2"/>}
                            Regenerate
                        </Button>
                      </div>
                 </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
