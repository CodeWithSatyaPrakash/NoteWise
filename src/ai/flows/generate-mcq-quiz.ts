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
  quiz: z.array(z.object({
    question: z.string().describe("The question text"),
    options: z.array(z.string()).describe("An array of 4 possible answers."),
    answer: z.string().describe("The correct answer from the options."),
    topic: z.string().describe("The specific topic from the text that this question covers, to help the user know what to review if they get it wrong.")
  })).describe("An array of quiz questions.")
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

  For each question, provide the question, 4 options, the correct answer, and the specific topic from the text the question is about. This topic will be shown to the user if they get the question wrong to help them study.

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
