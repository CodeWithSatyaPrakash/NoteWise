'use server';
/**
 * @fileOverview Generates structured study notes from a document.
 *
 * - generateSmartNotes - A function that generates structured notes from text content.
 * - GenerateSmartNotesInput - The input type for the generateSmartNotes function.
 * - GenerateSmartNotesOutput - The return type for the generateSmartNotes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSmartNotesInputSchema = z.object({
  pdfText: z
    .string()
    .describe('The text content extracted from the document.'),
  noteLength: z.enum(['short', 'long']).default('short').describe("The desired length of the notes: 'short' for a summary, 'long' for detailed notes."),
});
export type GenerateSmartNotesInput = z.infer<typeof GenerateSmartNotesInputSchema>;

const GenerateSmartNotesOutputSchema = z.object({
  notes: z.string().describe("The structured study notes in Markdown format, including headings, bullet points, and highlighted terms."),
});
export type GenerateSmartNotesOutput = z.infer<typeof GenerateSmartNotesOutputSchema>;

export async function generateSmartNotes(input: GenerateSmartNotesInput): Promise<GenerateSmartNotesOutput> {
  return generateSmartNotesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSmartNotesPrompt',
  input: {schema: GenerateSmartNotesInputSchema},
  output: {schema: GenerateSmartNotesOutputSchema},
  prompt: `You are an expert in creating structured and student-friendly study notes from a text document.

  Based on the provided text, generate study notes. The notes should be well-organized using headings and bullet points.
  Please highlight important terms, formulas, and concepts using Markdown for emphasis (e.g., using **bold** for key terms).
  
  Note Style:
  {{#if (eq noteLength "short")}}
  Generate concise, summary-style notes perfect for quick revision (like for a UG student). Focus on the absolute key points.
  {{else}}
  Generate detailed, comprehensive notes suitable for in-depth study (like for a PhD student). Cover all topics thoroughly.
  {{/if}}

  Document Text: {{{pdfText}}}`,
});

const generateSmartNotesFlow = ai.defineFlow(
  {
    name: 'generateSmartNotesFlow',
    inputSchema: GenerateSmartNotesInputSchema,
    outputSchema: GenerateSmartNotesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
