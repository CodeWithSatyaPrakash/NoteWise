
'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  HelpCircle,
  Youtube,
  MessageSquare,
  Volume2,
  Loader2,
  BookOpen,
  X,
  Send,
  RefreshCw,
  Sparkles,
  Clipboard,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { pdfUploadAndSummarize } from '@/ai/flows/pdf-upload-and-summarize';
import { generateMcqQuiz } from '@/ai/flows/generate-mcq-quiz';
import { topicRelatedVideoSuggestions } from '@/ai/flows/topic-related-video-suggestions';
import { realTimeAIInteraction } from '@/ai/flows/real-time-ai-interaction';
import { textToSpeech } from '@/ai/flows/text-to-speech';

type QuizItem = {
  question: string;
  options: string[];
  answer: string;
  topic: string;
};

type VideoSuggestion = {
  title: string;
  videoId: string;
  description: string;
};

type QnaMessage = {
  role: 'user' | 'ai';
  content: string;
};

export function PdfProStudyPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing PDF...');
  const [fileName, setFileName] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [numQuestions, setNumQuestions] = useState(5);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [quizDuration, setQuizDuration] = useState<number | null>(null);


  const [videos, setVideos] = useState<VideoSuggestion[] | null>(null);
  const [isVideosLoading, setIsVideosLoading] = useState(false);

  const [qnaMessages, setQnaMessages] = useState<QnaMessage[]>([]);
  const [isQnaLoading, setIsQnaLoading] = useState(false);
  const qnaInputRef = useRef<HTMLInputElement>(null);

  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        setLoadingMessage('Finding related videos...');
        await handleGetVideos(result.summary);
      } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to process PDF. Please try a different file.' });
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
    setIsQuizLoading(true);
    setQuiz(null);
    setUserAnswers({});
    setQuizScore(null);
    setQuizDuration(null);
    try {
      const result = await generateMcqQuiz({ pdfText: summary, numberOfQuestions: numQuestions });
      setQuiz(result.quiz);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not generate quiz. Please try again.' });
      console.error(e);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleGetVideos = async (text: string) => {
    if (!text) return;
    setIsVideosLoading(true);
    try {
      const result = await topicRelatedVideoSuggestions({ pdfContent: text });
      setVideos(result.videoSuggestions);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch video suggestions.' });
      console.error(e);
    } finally {
      setIsVideosLoading(false);
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
      setQnaMessages([...newMessages, { role: 'ai', content: "Sorry, I ran into an error. Please try again." }]);
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
      toast({ variant: 'destructive', title: 'Error', description: 'Text-to-speech failed.' });
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
    setVideos(null);
    setQnaMessages([]);
    setUserAnswers({});
    setQuizScore(null);
    setQuizDuration(null);
    setQuizStartTime(null);
  };
  
  const handleSubmitQuiz = () => {
    if (!quiz || !quizStartTime) return;
    const endTime = Date.now();
    setQuizDuration(Math.round((endTime - quizStartTime) / 1000));
    let score = 0;
    quiz.forEach((q, i) => {
      if (userAnswers[i] === q.answer) {
        score++;
      }
    });
    setQuizScore(score);
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
      
      <main className="flex-1">
        {!summary ? <Uploader /> : (
          <div className="container mx-auto p-4 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <aside className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText className="text-primary"/> Document</CardTitle>
                    <CardDescription className="truncate">{fileName}</CardDescription>
                  </CardHeader>
                </Card>
                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary"/> AI Summary</CardTitle>
                    <CardDescription>Key points from your document.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      <p className="text-sm">{summary}</p>
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="gap-2">
                     <Button variant="outline" size="sm" onClick={() => summary && handleTextToSpeech(summary)} disabled={isTtsLoading}>
                        {isTtsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
                        Listen
                     </Button>
                     <Button variant="ghost" size="sm" onClick={() => summary && navigator.clipboard.writeText(summary)}>
                        <Clipboard className="w-4 h-4 mr-2" /> Copy
                     </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><HelpCircle className="text-primary"/> Generate Quiz</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="num-questions">Number of Questions</Label>
                      <Input id="num-questions" type="number" value={numQuestions} onChange={(e) => setNumQuestions(parseInt(e.target.value, 10) || 1)} min="1" max="10" />
                    </div>
                  </CardContent>
                  <CardFooter>
                     <Button onClick={handleGenerateQuiz} disabled={isQuizLoading} className="w-full">
                        {isQuizLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        {quiz ? 'Regenerate Quiz' : 'Generate Quiz'}
                      </Button>
                  </CardFooter>
                </Card>
              </aside>

              <main className="lg:col-span-2">
                 <Tabs defaultValue="quiz">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="quiz"><HelpCircle className="w-4 h-4 mr-2" />Quiz</TabsTrigger>
                    <TabsTrigger value="qna"><MessageSquare className="w-4 h-4 mr-2" />Q&A</TabsTrigger>
                    <TabsTrigger value="videos"><Youtube className="w-4 h-4 mr-2" />Videos</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="quiz" className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Multiple Choice Quiz</CardTitle>
                        <CardDescription>Test your knowledge based on the document summary.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {isQuizLoading && <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
                        {!isQuizLoading && !quiz && <div className="text-center text-muted-foreground p-8">Generate a quiz to get started!</div>}
                        {quiz && (
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
                        )}
                      </CardContent>
                      {quiz && (
                        <CardFooter className="flex-col items-stretch gap-4">
                           {quizScore !== null && (
                            <div className="p-4 bg-muted rounded-lg text-center">
                              <p className="text-lg font-bold">Your Score: {quizScore}/{quiz.length}</p>
                              {quizDuration !== null && <p className="text-sm text-muted-foreground">Completed in {quizDuration} seconds</p>}
                            </div>
                           )}
                           <Button onClick={handleSubmitQuiz} disabled={quizScore !== null}>
                             Submit Quiz
                           </Button>
                        </CardFooter>
                      )}
                    </Card>
                  </TabsContent>

                   <TabsContent value="qna" className="mt-6">
                    <Card className="h-[600px] flex flex-col">
                      <CardHeader>
                         <CardTitle>Interactive Q&A</CardTitle>
                        <CardDescription>Ask questions and get answers from the PDF content.</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full pr-4">
                          <div className="space-y-4">
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
                      </CardContent>
                      <CardFooter>
                         <div className="flex w-full items-center space-x-2">
                           <Input ref={qnaInputRef} placeholder="Ask a question..." onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}/>
                           <Button onClick={handleAskQuestion} disabled={isQnaLoading}><Send className="w-4 h-4"/></Button>
                         </div>
                      </CardFooter>
                    </Card>
                  </TabsContent>

                  <TabsContent value="videos" className="mt-6">
                    <Card>
                       <CardHeader>
                         <CardTitle>Related Videos</CardTitle>
                        <CardDescription>Explore these YouTube videos for a deeper understanding.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {isVideosLoading && <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
                        {!isVideosLoading && !videos?.length && <div className="text-center text-muted-foreground p-8">No video suggestions found.</div>}
                        {videos && (
                          <div className="space-y-4">
                            {videos.map((video, i) => (
                              <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer" key={i} className="block">
                                <Card className="hover:bg-muted transition-colors">
                                  <CardHeader>
                                    <CardTitle className="text-base">{video.title}</CardTitle>
                                    <CardDescription>{video.description}</CardDescription>
                                  </CardHeader>
                                </Card>
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                 </Tabs>
              </main>
            </div>
            <audio ref={audioRef} className="hidden" />
          </div>
        )}
      </main>
    </div>
  );
}
