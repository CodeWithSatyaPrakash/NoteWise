'use server';
/**
 * @fileOverview Generates a multiple-choice quiz from a PDF document.
 *
 * - generateMcqQuiz - A function that generates a multiple-choice quiz from PDF content.
 * - GenerateMcqQuizInput - The input type for the generateMcqQuiz function.
 * - GenerateMcqQuizOutput - The return type for the generateMcqQuiz function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMcqQuizInputSchema = z.object({
  pdfText: z
    .string()
    .describe('The text content extracted from the PDF document.'),
  numberOfQuestions: z
    .number()
    .default(5)
    .describe('The number of multiple-choice questions to generate.'),
});
export type GenerateMcqQuizInput = z.infer<typeof GenerateMcqQuizInputSchema>;

const GenerateMcqQuizOutputSchema = z.object({
  quiz: z.string().describe('The generated multiple-choice quiz in JSON format.'),
});
export type GenerateMcqQuizOutput = z.infer<typeof GenerateMcqQuizOutputSchema>;

export async function generateMcqQuiz(input: GenerateMcqQuizInput): Promise<GenerateMcqQuizOutput> {
  return generateMcqQuizFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMcqQuizPrompt',
  input: {schema: GenerateMcqQuizInputSchema},
  output: {schema: GenerateMcqQuizOutputSchema},
  prompt: `You are an expert in generating multiple-choice quizzes from text documents.

  Given the following text from a PDF document, generate a multiple-choice quiz with {{numberOfQuestions}} questions.

  The quiz should be returned in JSON format, with the following structure:
  [{
    "question": "The question text",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "answer": "The correct answer"
  }]

  PDF Text: {{{pdfText}}}`,
});

const generateMcqQuizFlow = ai.defineFlow(
  {
    name: 'generateMcqQuizFlow',
    inputSchema: GenerateMcqQuizInputSchema,
    outputSchema: GenerateMcqQuizOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
