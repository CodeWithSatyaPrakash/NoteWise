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
  PenSquare
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';


import { pdfUploadAndSummarize } from '@/ai/flows/pdf-upload-and-summarize';
import { generateMcqQuiz } from '@/ai/flows/generate-mcq-quiz';
import { realTimeAIInteraction } from '@/ai/flows/real-time-ai-interaction';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { generateFlashcards, GenerateFlashcardsOutput } from '@/ai/flows/generate-flashcards';
import { generateSmartNotes } from '@/ai/flows/generate-smart-notes';

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
    return e instanceof Error && (e.message.includes('503') || e.message.toLowerCase().includes('overloaded'));
}

export function PdfProStudyPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<string | null>(null);
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [flashcards, setFlashcards] = useState<Flashcard[] | null>(null);
  const [isFlashcardLoading, setIsFlashcardLoading] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  const [smartNotes, setSmartNotes] = useState<string | null>(null);
  const [isSmartNotesLoading, setIsSmartNotesLoading] = useState(false);


  const [activeDialog, setActiveDialog] = useState<FeatureDialog>(null);

  useEffect(() => {
    if (quiz && quizScore === null) {
      setQuizStartTime(Date.now());
    }
  }, [quiz, quizScore]);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setLoadingMessage('Reading your PDF...');
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const pdfDataUri = reader.result as string;
      try {
        setLoadingMessage('Generating summary...');
        const result = await pdfUploadAndSummarize({ pdfDataUri });
        setSummary(result.summary);
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
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to read the file.' });
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
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({ variant: 'destructive', title: 'File Too Large', description: 'Please upload a PDF smaller than 10MB.' });
        return;
      }
      handleFileUpload(file);
    }
  };
  
  const handleGenerateQuiz = async () => {
    if (!summary) return;
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
      const result = await generateMcqQuiz({ pdfText: summary, numberOfQuestions: questions });
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
    if (!summary) return;
    setIsFlashcardLoading(true);
    setFlashcards(null);
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
    try {
      const result = await generateFlashcards({ pdfText: summary });
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
    if (!summary) return;
    setIsSmartNotesLoading(true);
    setSmartNotes(null);
    try {
      const result = await generateSmartNotes({ pdfText: summary });
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


  const handleAskQuestion = async () => {
    if (!summary || !qnaInputRef.current?.value.trim()) return;
    const question = qnaInputRef.current.value;
    qnaInputRef.current.value = '';
    
    const newMessages: QnaMessage[] = [...qnaMessages, { role: 'user', content: question }];
    setQnaMessages(newMessages);
    setIsQnaLoading(true);

    try {
      const result = await realTimeAIInteraction({ pdfContent: summary, userInput: question });
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
    setIsTtsLoading(true);
    try {
      const result = await textToSpeech(text);
      if (audioRef.current) {
        audioRef.current.src = result.media;
        audioRef.current.play();
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
  
  const handleReset = () => {
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
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--primary)/0.2)_1px,transparent_1px)] [background-size:16px_16px] animated-grid"></div>
      
      <div className="mb-8">
        <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit border-8 border-primary/20 mb-4 animate-pulse">
          <BookOpen className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">PDF Pro Study</h1>
        <p className="text-lg text-muted-foreground mt-2">Let AI accelerate your learning journey.</p>
      </div>

      <label htmlFor="file-upload" className="relative block w-full max-w-lg cursor-pointer">
        <div className="p-8 rounded-2xl bg-muted/50 border-2 border-dashed border-border transition-all duration-300 hover:border-primary hover:bg-muted/80 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-full group-hover:animate-bounce">
              <UploadCloud className="h-12 w-12 text-primary" />
            </div>
            <p className="text-xl font-semibold">Drop PDF Here</p>
            <p className="text-muted-foreground">or click to browse your files</p>
          </div>
        </div>
        <input id="file-upload" type="file" className="sr-only" accept="application/pdf" onChange={handleFileChange} />
      </label>
      <p className="text-xs text-muted-foreground mt-6">Max file size: 10MB. We promise to keep your data safe.</p>
    </div>
  );
  
  const FeatureNode = ({ icon, title, onClick, className }: { icon: React.ElementType, title: string, onClick: () => void, className?: string }) => {
    const Icon = icon;
    
    return (
      <div className={cn("group relative z-10", className)}>
         <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
         <Button onClick={onClick} className="relative rounded-full w-32 h-32 flex-col gap-2 shadow-lg" variant="outline">
          <Icon className="w-8 h-8 text-primary" />
          <span className="text-sm text-center">{title}</span>
        </Button>
      </div>
    );
  };
  
  const FeatureHub = () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--primary)/0.2)_1px,transparent_1px)] [background-size:16px_16px] animated-grid"></div>
      
      <div className="relative w-[600px] h-[500px]">
        {/* SVG Lines */}
        <svg className="absolute w-full h-full" style={{ top: 0, left: 0 }}>
            {/* Line to top node */}
            <line x1="50%" y1="50%" x2="50%" y2="66" stroke="hsl(var(--border))" strokeWidth="2" />
            {/* Line to top-left node */}
            <line x1="50%" y1="50%" x2="calc(15%)" y2="calc(25%)" stroke="hsl(var(--border))" strokeWidth="2" />
             {/* Line to top-right node */}
            <line x1="50%" y1="50%" x2="calc(100% - 66px)" y2="calc(25%)" stroke="hsl(var(--border))" strokeWidth="2" />
            {/* Line to bottom-left node */}
            <line x1="50%" y1="50%" x2="calc(25%)" y2="calc(100% - 66px)" stroke="hsl(var(--border))" strokeWidth="2" />
            {/* Line to bottom-right node */}
            <line x1="50%" y1="50%" x2="calc(100% - 140px)" y2="calc(100% - 66px)" stroke="hsl(var(--border))" strokeWidth="2" />
        </svg>
        
        {/* Central Hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center text-center">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit border-8 border-primary/20 mb-4">
            <Lightbulb className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Doc Received!</h2>
          <p className="text-muted-foreground truncate max-w-xs">{fileName}</p>
        </div>
        
        {/* Feature Nodes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
            <FeatureNode icon={Sparkles} title="AI Summary" onClick={() => setActiveDialog('summary')} />
        </div>
        <div className="absolute top-1/4 left-[5%]">
            <FeatureNode icon={HelpCircle} title="Generate Quiz" onClick={() => setActiveDialog('quiz')} />
        </div>
        <div className="absolute top-1/4 right-0">
            <FeatureNode icon={PenSquare} title="Smart Notes" onClick={() => setActiveDialog('smart-notes')} />
        </div>
        <div className="absolute bottom-0 left-1/4 -translate-x-1/2">
            <FeatureNode icon={MessageSquare} title="Chat with AI" onClick={() => setActiveDialog('qna')} />
        </div>
        <div className="absolute bottom-0 right-0">
            <FeatureNode icon={Copy} title="Flashcards" onClick={() => setActiveDialog('flashcards')} />
        </div>

      </div>
    </div>
  );


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <Loader2 className="w-16 h-16 animate-spin text-primary" />
        <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
        <p className="text-muted-foreground">{fileName}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className={cn("sticky top-0 z-50 flex items-center justify-between h-16 px-4", summary && "border-b bg-background/80 backdrop-blur-sm")}>
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">PDF Pro Study</h1>
        </div>
        {summary && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Start Over
          </Button>
        )}
      </header>
      
      <main className="flex-1 flex items-center justify-center">
        {!summary ? <Uploader /> : <FeatureHub />}
      </main>
      
      {/* Dialog for AI Summary */}
      <Dialog open={activeDialog === 'summary'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="text-primary"/> AI Summary</DialogTitle>
            <DialogDescription>Key points from your document.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-64 pr-4">
            <p className="text-sm">{summary}</p>
          </ScrollArea>
          <DialogFooter className="gap-2 sm:justify-start">
             <Button variant="outline" size="sm" onClick={() => summary && handleTextToSpeech(summary)} disabled={isTtsLoading}>
                {isTtsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
                Listen
             </Button>
             <Button variant="ghost" size="sm" onClick={() => summary && navigator.clipboard.writeText(summary)}>
                <Clipboard className="w-4 h-4 mr-2" /> Copy
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog for Quiz */}
      <Dialog open={activeDialog === 'quiz'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Multiple Choice Quiz</DialogTitle>
            <DialogDescription>Test your knowledge based on the document summary.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitQuiz}>
            {!quiz && !isQuizLoading && (
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
            
            {quiz && (
              <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {quiz.map((q, i) => (
                  <div key={i}>
                    <p className="font-semibold mb-2">{i + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, j) => {
                        const isSelected = userAnswers[i] === opt;
                        const isCorrect = q.answer === opt;
                        const isSubmitted = quizScore !== null;
                        return (
                        <Button type="button" key={j} variant="outline" className={cn("w-full justify-start text-left h-auto py-2", 
                          isSelected && "border-primary",
                          isSubmitted && isCorrect && "bg-green-500/20 border-green-500",
                          isSubmitted && isSelected && !isCorrect && "bg-red-500/20 border-red-500"
                          )}
                          onClick={() => setUserAnswers(prev => ({...prev, [i]: opt}))}
                          disabled={isSubmitted}
                          >
                          {opt}
                        </Button>
                        )
                      })}
                    </div>
                    {quizScore !== null && userAnswers[i] !== q.answer && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertDescription>
                          Review the section on: <strong>{q.topic}</strong>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
              </ScrollArea>
            )}

          {quiz && (
            <DialogFooter className="flex-col items-stretch gap-4 sm:flex-col sm:items-stretch mt-4">
               {quizScore !== null ? (
                <div className="p-4 bg-muted rounded-lg text-center">
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
                  <Button onClick={handleGenerateQuiz} className="mt-4 w-full" variant="secondary" type="button">
                     <RefreshCw className="w-4 h-4 mr-2"/>
                     Regenerate Quiz
                  </Button>
                </div>
               ) : (
                <Button type="submit" disabled={Object.keys(userAnswers).length !== quiz.length}>
                  Submit Quiz
                </Button>
               )
              }
            </DialogFooter>
          )}
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog for Q&A */}
      <Dialog open={activeDialog === 'qna'} onOpenChange={() => setActiveDialog(null)}>
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
      <Dialog open={activeDialog === 'flashcards'} onOpenChange={() => setActiveDialog(null)}>
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
      <Dialog open={activeDialog === 'smart-notes'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PenSquare className="text-primary"/> Smart Study Notes</DialogTitle>
            <DialogDescription>Your structured study notes, ready for review.</DialogDescription>
          </DialogHeader>
          
          {!smartNotes && !isSmartNotesLoading && (
              <div className="flex flex-col items-center gap-4 py-8">
                  <p className="text-center text-muted-foreground">Generate structured notes from the document's summary.</p>
                  <Button onClick={handleGenerateSmartNotes} disabled={isSmartNotesLoading}>
                      {isSmartNotesLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Generate Notes
                  </Button>
              </div>
          )}

          {isSmartNotesLoading && <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
          
          {smartNotes && (
            <>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{smartNotes}</ReactMarkdown>
                </div>
              </ScrollArea>
              <DialogFooter className="gap-2 sm:justify-start">
                 <Button variant="ghost" size="sm" onClick={() => smartNotes && navigator.clipboard.writeText(smartNotes)}>
                    <Clipboard className="w-4 h-4 mr-2" /> Copy
                 </Button>
                 <Button onClick={handleGenerateSmartNotes} variant="secondary" size="sm">
                     <RefreshCw className="w-4 h-4 mr-2"/>
                     Regenerate
                  </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
