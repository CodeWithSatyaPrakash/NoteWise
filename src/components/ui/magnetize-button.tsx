"use client" 

import * as React from "react"

import { cn } from "@/lib/utils";
import { motion, useAnimation } from "framer-motion";
import { Magnet, ArrowRight } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface MagnetizeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    particleCount?: number;
    attractRadius?: number;
    children?: React.ReactNode;
}

interface Particle {
    id: number;
    x: number;
    y: number;
}

function MagnetizeButton({
    className,
    particleCount = 20,
    children,
    ...props
}: MagnetizeButtonProps) {
    const [isAttracting, setIsAttracting] = useState(false);
    const [particles, setParticles] = useState<Particle[]>([]);
    const particlesControl = useAnimation();

    useEffect(() => {
        const newParticles = Array.from({ length: particleCount }, (_, i) => ({
            id: i,
            x: Math.random() * 200 - 100,
            y: Math.random() * 200 - 100,
        }));
        setParticles(newParticles);
    }, [particleCount]);

    const handleInteractionStart = useCallback(async () => {
        setIsAttracting(true);
        await particlesControl.start({
            x: 0,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 80,
                damping: 15,
                mass: 0.5,
            },
        });
    }, [particlesControl]);

    const handleInteractionEnd = useCallback(async () => {
        setIsAttracting(false);
        await particlesControl.start((i) => ({
            x: particles[i].x,
            y: particles[i].y,
            transition: {
                type: "spring",
                stiffness: 50,
                damping: 10,
            },
        }));
    }, [particlesControl, particles]);

    return (
        <Button
            size="lg"
            className={cn(
                "relative touch-none overflow-hidden transition-all duration-300",
                className
            )}
            onMouseEnter={handleInteractionStart}
            onMouseLeave={handleInteractionEnd}
            onTouchStart={handleInteractionStart}
            onTouchEnd={handleInteractionEnd}
            {...props}
        >
            {particles.map((_, index) => (
                <motion.div
                    key={index}
                    custom={index}
                    initial={{ x: particles[index]?.x, y: particles[index]?.y }}
                    animate={particlesControl}
                    className={cn(
                        "absolute w-1.5 h-1.5 rounded-full bg-primary-foreground/50",
                        "transition-opacity duration-300",
                        isAttracting ? "opacity-100" : "opacity-0"
                    )}
                />
            ))}
            <span className="relative z-10 w-full flex items-center justify-center gap-2">
                {children}
            </span>
        </Button>
    );
}

export { MagnetizeButton }
