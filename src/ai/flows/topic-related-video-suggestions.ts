'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating topic-related YouTube video suggestions based on PDF content.
 *
 * - topicRelatedVideoSuggestions - A function that takes PDF content as input and returns a list of YouTube video suggestions.
 * - TopicRelatedVideoSuggestionsInput - The input type for the topicRelatedVideoSuggestions function.
 * - TopicRelatedVideoSuggestionsOutput - The return type for the topicRelatedVideoSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TopicRelatedVideoSuggestionsInputSchema = z.object({
  pdfContent: z.string().describe('The text content extracted from the PDF document.'),
});
export type TopicRelatedVideoSuggestionsInput = z.infer<typeof TopicRelatedVideoSuggestionsInputSchema>;

const TopicRelatedVideoSuggestionsOutputSchema = z.object({
  videoSuggestions: z.array(
    z.object({
      title: z.string().describe('The title of the YouTube video.'),
      url: z.string().url().describe('The URL of the YouTube video.'),
      description: z.string().describe('A brief description of the YouTube video.'),
    })
  ).describe('A list of topic-related YouTube video suggestions.'),
});
export type TopicRelatedVideoSuggestionsOutput = z.infer<typeof TopicRelatedVideoSuggestionsOutputSchema>;

export async function topicRelatedVideoSuggestions(input: TopicRelatedVideoSuggestionsInput): Promise<TopicRelatedVideoSuggestionsOutput> {
  return topicRelatedVideoSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'topicRelatedVideoSuggestionsPrompt',
  input: {schema: TopicRelatedVideoSuggestionsInputSchema},
  output: {schema: TopicRelatedVideoSuggestionsOutputSchema},
  prompt: `You are a helpful AI assistant that suggests YouTube videos related to a given text document.

  Given the following text from a PDF document, suggest 3 YouTube videos that would be helpful for someone trying to understand the content.
  Return the suggestions as a JSON array.

  PDF Content: {{{pdfContent}}}
  `,
});

const topicRelatedVideoSuggestionsFlow = ai.defineFlow(
  {
    name: 'topicRelatedVideoSuggestionsFlow',
    inputSchema: TopicRelatedVideoSuggestionsInputSchema,
    outputSchema: TopicRelatedVideoSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
