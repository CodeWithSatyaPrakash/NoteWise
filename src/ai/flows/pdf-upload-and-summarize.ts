'use server';
/**
 * @fileOverview This file contains the Genkit flow for generating a concise summary of text content.
 *
 * - pdfUploadAndSummarize - A function that handles the summarization process.
 * - PdfUploadAndSummarizeInput - The input type for the pdfUploadAndSummarize function.
 * - PdfUploadAndSummarizeOutput - The return type for the pdfUploadAndSummarize function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PdfUploadAndSummarizeInputSchema = z.object({
  pdfText: z
    .string()
    .describe(
      "The text content extracted from a PDF document."
    ),
});
export type PdfUploadAndSummarizeInput = z.infer<typeof PdfUploadAndSummarizeInputSchema>;

const PdfUploadAndSummarizeOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the PDF document.'),
});
export type PdfUploadAndSummarizeOutput = z.infer<typeof PdfUploadAndSummarizeOutputSchema>;

export async function pdfUploadAndSummarize(input: PdfUploadAndSummarizeInput): Promise<PdfUploadAndSummarizeOutput> {
  return pdfUploadAndSummarizeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'pdfUploadAndSummarizePrompt',
  input: {schema: PdfUploadAndSummarizeInputSchema},
  output: {schema: PdfUploadAndSummarizeOutputSchema},
  prompt: `You are an expert summarizer of documents.

You will receive text extracted from a document. Your task is to generate a concise summary of the document, highlighting the main ideas and key points.

Document Text: {{{pdfText}}}`,
});

const pdfUploadAndSummarizeFlow = ai.defineFlow(
  {
    name: 'pdfUploadAndSummarizeFlow',
    inputSchema: PdfUploadAndSummarizeInputSchema,
    outputSchema: PdfUploadAndSummarizeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
