// Implements the real-time AI interaction flow for conversing about the PDF content.

'use server';

/**
 * @fileOverview This file defines the real-time AI interaction flow, allowing users to have a conversation with an AI about the PDF content.
 *
 * - realTimeAIInteraction - A function that initiates the real-time AI interaction flow.
 * - RealTimeAIInteractionInput - The input type for the realTimeAIInteraction function.
 * - RealTimeAIInteractionOutput - The return type for the realTimeAIInteraction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RealTimeAIInteractionInputSchema = z.object({
  pdfContent: z.string().describe('The content of the PDF document.'),
  userInput: z.string().describe('The user input/question about the PDF content.'),
});
export type RealTimeAIInteractionInput = z.infer<typeof RealTimeAIInteractionInputSchema>;

const RealTimeAIInteractionOutputSchema = z.object({
  aiResponse: z.string().describe('The AI response to the user input based on the PDF content.'),
});
export type RealTimeAIInteractionOutput = z.infer<typeof RealTimeAIInteractionOutputSchema>;

export async function realTimeAIInteraction(input: RealTimeAIInteractionInput): Promise<RealTimeAIInteractionOutput> {
  return realTimeAIInteractionFlow(input);
}

const realTimeAIInteractionPrompt = ai.definePrompt({
  name: 'realTimeAIInteractionPrompt',
  input: {schema: RealTimeAIInteractionInputSchema},
  output: {schema: RealTimeAIInteractionOutputSchema},
  prompt: `You are a helpful AI assistant designed to help students understand PDF documents. Use the content of the PDF provided to answer the user's questions.

PDF Content: {{{pdfContent}}}

User Question: {{{userInput}}}

AI Response:`,  
});

const realTimeAIInteractionFlow = ai.defineFlow(
  {
    name: 'realTimeAIInteractionFlow',
    inputSchema: RealTimeAIInteractionInputSchema,
    outputSchema: RealTimeAIInteractionOutputSchema,
  },
  async input => {
    const {output} = await realTimeAIInteractionPrompt(input);
    return output!;
  }
);
