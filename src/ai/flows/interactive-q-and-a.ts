'use server';
/**
 * @fileOverview This file defines a Genkit flow for interactive Q&A with a PDF document.
 *
 * - askQuestion - A function that allows users to ask questions about the PDF content and receive answers directly from the PDF.
 * - AskQuestionInput - The input type for the askQuestion function.
 * - AskQuestionOutput - The return type for the askQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AskQuestionInputSchema = z.object({
  pdfContent: z
    .string()
    .describe('The text content extracted from the PDF document.'),
  question: z.string().describe('The user question about the PDF content.'),
});
export type AskQuestionInput = z.infer<typeof AskQuestionInputSchema>;

const AskQuestionOutputSchema = z.object({
  answer: z.string().describe('The answer to the user question, based on the PDF content.'),
});
export type AskQuestionOutput = z.infer<typeof AskQuestionOutputSchema>;

export async function askQuestion(input: AskQuestionInput): Promise<AskQuestionOutput> {
  return askQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'askQuestionPrompt',
  input: {schema: AskQuestionInputSchema},
  output: {schema: AskQuestionOutputSchema},
  prompt: `You are an AI assistant that answers questions based on the content of a PDF document.
  Your goal is to provide accurate and concise answers to the user's questions, using only the information provided in the PDF content.

  PDF Content:
  {{pdfContent}}

  Question:
  {{question}}

  Answer:`,
});

const askQuestionFlow = ai.defineFlow(
  {
    name: 'askQuestionFlow',
    inputSchema: AskQuestionInputSchema,
    outputSchema: AskQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
