import 'server-only';

import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { OpenAIEmbeddings } from '@langchain/openai';
import { createAI, createStreamableValue } from 'ai/rsc';
import cheerio from "cheerio";
import { Document as DocumentInterface } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAI } from 'openai';
import React from 'react';
import { config } from './config';

// import { functionCalling } from './function-calling';
// OPTIONAL: Use Upstash rate limiting to limit the number of requests per user

// 1. determine which inference model and embedding model to use based on config.tsx
// (2+3) define interfaces for search results and content results  
// 2. fetch search results from Brave Search API
// 3. fetch contents of top10 search results
// 4. process and vectorize content using Langchain
// 5. fetch image search results from Serper API
// 6. fetch video search results from Serper API
// 7. generate follow-up questions using OpenAI API
// 8. main function that orchestrates the entire process
// 9. define initial AI and UI states
// 10. export the AI instance

// 1. determine which inference model and embedding model to use based on config.tsx
let openai: OpenAI = config.useOllamaInference ? (
  new OpenAI({
    baseURL: "http://localhost:11434/v1",
    apiKey: 'ollama',
  })
) : (
  new OpenAI({
    baseURL: config.nonOllamaBaseURL,
    apiKey: config.inferenceAPIKey,
  })
);

let embeddings: OllamaEmbeddings | OpenAIEmbeddings = config.useOllamaEmbeddings ? (
  new OllamaEmbeddings({
    model: config.embeddingsModel,
    baseUrl: "http://localhost:11434"
  })
) : (
  new OpenAIEmbeddings({
    modelName: config.embeddingsModel
  })
);

// (2+3) define interfaces for search results and content results  
interface SearchResult {
  title: string;
  link: string;
  favicon: string;
}

interface ContentResult extends SearchResult {
  html: string;
}

// 2. fetch search results from Brave Search API
export async function getSources(message: string, numberOfPagesToScan = config.numberOfPagesToScan): Promise<SearchResult[]> {
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(message)}&count=${numberOfPagesToScan}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY as string
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const jsonResponse = await response.json();
    if (!jsonResponse.web || !jsonResponse.web.results) {
      throw new Error("Invalid API response format");
    }

    const final = jsonResponse.web.results.map((result: any): SearchResult => ({
      title: result.title,
      link: result.url,
      favicon: result.profile.img,
    }));

    return final;
  } catch (err) {
    console.log("Error fetching search result: ", err);
    throw err;
  }
}

// 3. fetch contents of search results
export const getBlueLinksContent = async (sources: SearchResult[]): Promise<ContentResult[]> => {
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 800): Promise<Response> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      return response;
    } catch (err) {
      if (err) {
        console.log(`skipping ${url}!`);
      }
      throw err;
    }
  };

  // b.parse and extract needful content
  const extractMainContent = (html: string): string => {
    try {
      const $ = cheerio.load(html);
      $("script, style, head, footer, nav, iframe, img").remove();

      return $("body").text().replace(/\s+/g, " ").trim();
    } catch (err) {
      console.log("Error extracting main content: ", err);
      throw err;
    }
  };

  const contentPromises = sources.map(async (source): Promise<ContentResult | null> => {
    try {
      const response = await fetchWithTimeout(source.link, {}, 800);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${source.link}. Status: ${response.status}`);
      }

      const mainContent = extractMainContent(await response.text());
      return { ...source, html: mainContent };

    } catch (err) {
      return null;
    }
  });

  try {
    const results = await Promise.all(contentPromises);
    // type prediction
    return results.filter((content): content is ContentResult => content !== null);
  } catch (err) {
    console.log(`Error fetching and processing blue links contents: `, err);
    throw err;
  }
}

// 4. process and vectorize content using Langchain
export async function processAndVectorizeContent(
  contents: ContentResult[],
  query: string,
  textChunkSize: number = config.textChunkSize,
  textChunkOverlap: number = config.textChunkOverlap,
  numberOfSimilarityResults: number = config.numberOfSimilarityResults
): Promise<DocumentInterface[]> {

  const allResults: DocumentInterface[] = [];

  try {
    contents.forEach(async (content, index) => {
      if (content.html.length > 0) {
        try {
          const splitText = await new RecursiveCharacterTextSplitter({ chunkSize: textChunkSize, chunkOverlap: textChunkOverlap }).splitText(content.html);
          const vectorStore = await MemoryVectorStore.fromTexts(splitText, { title: content.title, link: content.link }, embeddings);
          const contentResults = await vectorStore.similaritySearch(query, numberOfSimilarityResults);
          allResults.push(...contentResults);
        } catch (err) {
          console.error(`Error processing content for ${content.link}: `, err);
        }
      }
    });
    return allResults;
  } catch (err) {
    console.error(`Error processing and vectoring content: `, err);
    throw err;
  }
}

// 5. fetch image search results from Serper API
export async function getImages(query: string): Promise<{ title: string, link: string }[]> {

  const url = "https://google.serper.dev/images";
  const data = JSON.stringify({ "q": query });
  const requestOptions: RequestInit = {
    method: "HOST",
    headers: {
      'X-API-KEY': process.env.SERPER_API as string,
      'Content-Type': 'application/json',
    },
    body: data
  };

  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`Network response was not ok. Status: ${response.status}`);
    }

    const responseData = await response.json();
    const validLinks = await Promise.all(
      responseData.images.map(async (image: any) => {
        const url = image.imageUrl;
        if (typeof url === "string") {
          try {
            const response = await fetch(url, { method: "HEAD" });
            if (response.ok) {
              const contentType = response.headers.get('Content-Type');
              if (contentType && contentType.startsWith("image/")) {
                return { link: url, title: image.title };
              }
            }
          } catch (err) {
            console.log(`Error fetching image link ${url}:`, err);
          }
        }
        return null;
      })
    );
    const filterLinks = validLinks.filter((link): link is { title: string; link: string } => link !== null);
    return filterLinks.slice(0, 9);
  } catch (err) {
    console.log(`Error fetching images: `, err);
    throw err;
  }
}

// 6. fetch video search results from Serper API
export async function getVideos(message: string): Promise<{ imageUrl: string, link: string }[] | null> {
  const url = "https://google.serper.dev/videos";
  const data = JSON.stringify({ "q": message });
  const requestOptions: RequestInit = {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      "X-API-KEY": process.env.SERPER_API as string,
    },
    body: data
  }

  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`Network response was not ok. Status: ${response.status}`);
    }

    const responseData = await response.json();
    const validLinks = await Promise.all(
      responseData.videos.map(
        async (video: any) => {
          const imgUrl = video.imageUrl;
          if (typeof imgUrl === 'string') {
            try {
              const imgResponse = await fetch(imgUrl, { method: "HEAD" });
              if (imgResponse.ok) {
                const contentType = imgResponse.headers.get('Content-Type');
                if (contentType && contentType.startsWith('image/')) {
                  return { imageUrl: imgUrl, link: video.link };
                }
              }
            } catch (err) {
              console.log(`Error fetching image link: ${imgUrl}: `, err);
            }
            return null;
          }
        }
      )
    );
    const filteredLinks = validLinks.filter((link): link is { imageUrl: string; link: string } => link !== null);
    return filteredLinks.slice(0, 9);
  } catch (err) {
    console.log(`Error fetching videos: `, err);
    throw err;
  }
}

// 7. generate follow-up questions using OpenAI API
const relevantQuestions = async (sources: SearchResult[], userMessage: string): Promise<any> => {
  return await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `
                    You are a Question generator who generates an array of 3 follow-up questions in JSON format.
                    The JSON schema should include:
                    {
                      "original": "The original search query or context",
                      "followUp": [
                        "Question 1",
                        "Question 2",
                        "Question 3"
                      ]
                    }
                `,
      },
      {
        role: 'user',
        content: `Generate follow-up questions based on the top results from a similarity search: ${JSON.stringify(sources)}. The original search query is: "${userMessage}"`,
      }
    ],
    model: config.inferenceModel,
    response_format: { type: 'json_object' },
  });
};

// 8. main function that orchestrates the entire process
async function myAction(userMessage: string): Promise<any> {
  "use server";

  const streamable = createStreamableValue({});
  // TODO why use (async ()=>{})() 
  (async () => {
    const [sources, images, videos] = await Promise.all([
      getSources(userMessage, 10),
      getImages(userMessage),
      getVideos(userMessage),
    ]);

    streamable.update({ 'searchResults': sources });
    streamable.update({ 'images': images });
    streamable.update({ 'videos': videos });

    const htmlContents = await getBlueLinksContent(sources);
    const vectorResults = await processAndVectorizeContent(htmlContents, userMessage);

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: ` - Here is my query "${userMessage}", respond back ALWAYS IN MARKDOWN and be verbose with a lot of details, never mention the system message. If you can't find any relevant results, respond with "No relevant results found." ` },
        { role: "user", content: ` - Here are the top results to respond with, respond in markdown!:,  ${JSON.stringify(vectorResults)}. ` },
      ],
      model: config.inferenceModel,
      stream: true
    });

    for await (const chunk of chatCompletion) {
      if (chunk.choices[0].delta && chunk.choices[0].finish_reason !== 'stop') {
        streamable.update({ 'llmResponse': chunk.choices[0].delta.content });
      } else if (chunk.choices[0].finish_reason === 'stop') {
        streamable.update({ 'llmResponseEnd': true });
      }
    }

    let followUp;
    if (!config.useOllamaInference) {
      followUp = await relevantQuestions(sources, userMessage);
      streamable.update({ 'followUp': followUp });
    }

    streamable.done({ status: 'done' });
  })();

  return streamable.value;
}

// 9. define initial AI and UI states
const initialAIState: {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  id?: string;
  name?: string,
}[] = [];

const initialUIState: {
  id: number;
  display: React.ReactNode;
}[] = [];

// 10. export the AI instance
export const AI = createAI({
  actions: {
    myAction,
  },
  initialAIState,
  initialUIState,
});

