
'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
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

import { pdfUploadAndSummarize } from '@/ai/flows/pdf-upload-and-summarize';
import { generateMcqQuiz } from '@/ai/flows/generate-mcq-quiz';
import { realTimeAIInteraction } from '@/ai/flows/real-time-ai-interaction';
import { textToSpeech } from '@/ai/flows/text-to-speech';

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

type FeatureDialog = 'summary' | 'quiz' | 'qna' | null;

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
  };
  
  const handleSubmitQuiz = () => {
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

  const Uploader = () => (
    <div className="flex items-center justify-center h-full p-4">
      <Card className="w-full max-w-lg text-center shadow-2xl">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="mt-4 text-2xl">PDF Pro Study</CardTitle>
          <CardDescription>Upload your PDF and let AI accelerate your learning.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-lg p-8 space-y-2">
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Drag & drop your PDF here, or click to browse.</p>
            <p className="text-xs text-muted-foreground">Max file size: 10MB</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild size="lg" className="w-full">
            <label htmlFor="file-upload" className="cursor-pointer">
              Upload PDF
              <input id="file-upload" type="file" className="sr-only" accept="application/pdf" onChange={handleFileChange} />
            </label>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
  
  const FeatureNode = ({ icon, title, onClick, angle, distance }: { icon: React.ElementType, title: string, onClick: () => void, angle: number, distance: number }) => {
    const Icon = icon;
    const x = Math.cos(angle * Math.PI / 180) * distance;
    const y = Math.sin(angle * Math.PI / 180) * distance;

    const style = {
      transform: `translate(${x}rem, ${y}rem)`,
    };
    
    return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={style}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-px bg-border" style={{width: `${distance}rem`, transform: `rotate(${angle+180}deg) translate(${distance/2}rem)`}}/>
        <Button onClick={onClick} className="rounded-full w-24 h-24 flex-col gap-1 shadow-lg" variant="outline">
          <Icon className="w-6 h-6 text-primary" />
          <span className="text-xs text-center">{title}</span>
        </Button>
      </div>
    );
  };

  const FeatureHub = () => (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-96 h-96 flex items-center justify-center">
        {/* Central Hub */}
        <div className="absolute w-32 h-32 bg-primary/10 rounded-full flex flex-col items-center justify-center gap-2 text-center p-2 z-10">
          <Lightbulb className="w-10 h-10 text-primary" />
          <p className="text-sm font-semibold">Doc Received!</p>
          <p className="text-xs text-muted-foreground truncate w-full">{fileName}</p>
        </div>

        {/* Feature Nodes */}
        <FeatureNode icon={Sparkles} title="AI Summary" onClick={() => setActiveDialog('summary')} angle={-30} distance={12} />
        <FeatureNode icon={HelpCircle} title="Generate Quiz" onClick={() => setActiveDialog('quiz')} angle={90} distance={12} />
        <FeatureNode icon={MessageSquare} title="Chat with AI" onClick={() => setActiveDialog('qna')} angle={210} distance={12} />
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
      <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 border-b bg-background/80 backdrop-blur-sm">
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
          
            {!quiz && !isQuizLoading && (
              <div className="flex flex-col items-center gap-4 py-8">
                  <Label htmlFor="num-questions">Number of Questions</Label>
                  <Input id="num-questions" type="number" value={numQuestions} onChange={(e) => setNumQuestions(e.target.value === '' ? '' : parseInt(e.target.value, 10))} min="1" max="20" placeholder="e.g., 5" className="w-48"/>
                  <Button onClick={handleGenerateQuiz} disabled={isQuizLoading || !numQuestions} className="w-48">
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
                        <Button key={j} variant="outline" className={cn("w-full justify-start text-left h-auto py-2", 
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
            <DialogFooter className="flex-col items-stretch gap-4 sm:flex-col sm:items-stretch">
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
                  <Button onClick={handleGenerateQuiz} className="mt-4 w-full" variant="secondary">
                     <RefreshCw className="w-4 h-4 mr-2"/>
                     Regenerate Quiz
                  </Button>
                </div>
               ) : (
                <Button onClick={handleSubmitQuiz} disabled={Object.keys(userAnswers).length !== quiz.length}>
                  Submit Quiz
                </Button>
               )
              }
            </DialogFooter>
          )}
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
      
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
