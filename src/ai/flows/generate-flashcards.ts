'use server';
/**
 * @fileOverview Generates flashcards from a PDF document.
 *
 * - generateFlashcards - A function that generates flashcards from PDF content.
 * - GenerateFlashcardsInput - The input type for the generateFlashcards function.
 * - GenerateFlashcardsOutput - The return type for the generateFlashcards function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFlashcardsInputSchema = z.object({
  pdfText: z
    .string()
    .describe('The text content extracted from the PDF document.'),
});
export type GenerateFlashcardsInput = z.infer<typeof GenerateFlashcardsInputSchema>;

const GenerateFlashcardsOutputSchema = z.object({
  flashcards: z.array(z.object({
    front: z.string().describe("The front of the flashcard, which should be a question or a keyword."),
    back: z.string().describe("The back of the flashcard, which should be the answer or definition."),
  })).describe("An array of 10 flashcards.")
});
export type GenerateFlashcardsOutput = z.infer<typeof GenerateFlashcardsOutputSchema>;

export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GenerateFlashcardsOutput> {
  return generateFlashcardsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFlashcardsPrompt',
  input: {schema: GenerateFlashcardsInputSchema},
  output: {schema: GenerateFlashcardsOutputSchema},
  prompt: `You are an expert in creating educational flashcards from text documents.

  Given the following text from a PDF document, generate exactly 10 flashcards.

  For each flashcard, provide a "front" with a question or keyword, and a "back" with the corresponding answer or definition. The content should be clear and concise for use in digital flashcard tools.

  PDF Text: {{{pdfText}}}`,
});

const generateFlashcardsFlow = ai.defineFlow(
  {
    name: 'generateFlashcardsFlow',
    inputSchema: GenerateFlashcardsInputSchema,
    outputSchema: GenerateFlashcardsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
