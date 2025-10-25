"use client";
import React from "react";
import { SparklesCore } from "@/components/ui/sparkles";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function SplashScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="h-screen relative w-full bg-background flex flex-col items-center justify-center overflow-hidden">
      <div className="w-full absolute inset-0 h-screen">
        <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={100}
          className="w-full h-full"
          particleColor="hsl(var(--primary))"
          speed={1}
        />
      </div>
      <div className="flex flex-col items-center justify-center gap-4 relative z-20">
        <h1 className="md:text-7xl text-5xl lg:text-8xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-200 to-neutral-500 py-8">
          NoteWise AI
        </h1>
        <p className="text-muted-foreground text-center text-lg md:text-xl max-w-2xl">
          Transform your PDFs into summaries, quizzes, and interactive study materials. Let AI accelerate your learning journey.
        </p>
        <Button size="lg" className="mt-8" onClick={onGetStarted}>
          Get Started
          <ArrowRight className="ml-2" />
        </Button>
      </div>
    </div>
  );
}
