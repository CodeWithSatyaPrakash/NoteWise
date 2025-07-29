'use server';
/**
 * @fileOverview This file contains the Genkit flow for uploading a PDF document and generating a concise summary of its content.
 *
 * - pdfUploadAndSummarize - A function that handles the PDF upload and summarization process.
 * - PdfUploadAndSummarizeInput - The input type for the pdfUploadAndSummarize function.
 * - PdfUploadAndSummarizeOutput - The return type for the pdfUploadAndSummarize function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PdfUploadAndSummarizeInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF document as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
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
  prompt: `You are an expert summarizer of PDF documents.

You will receive a PDF document as a data URI. Your task is to generate a concise summary of the document, highlighting the main ideas and key points.

PDF Document: {{media url=pdfDataUri}}`,
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
