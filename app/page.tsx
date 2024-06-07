'use client';

// 1. Import Dependencies
import { FormEvent, useEffect, useRef, useState, useCallback, use } from 'react';
import { useActions, readStreamableValue } from 'ai/rsc';
import { type AI } from './action';
import { ChatScrollAnchor } from '@/lib/hooks/chat-scroll-anchor';
import Textarea from 'react-textarea-autosize';
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit';
import { Tooltip, TooltipContent, TooltipTrigger, } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import InitialQueries from '@/components/answer/InitialQueries';
import { ArrowUp } from '@phosphor-icons/react/dist/ssr';
import { runThread } from './serveraction';
// Main components 
// Sidebar components
// Function calling components

// 2. Set up types
interface Message {
  id: number;
  type: string;
  content: string;
  userMessage: string;
  followUp: FollowUp | null;
  images: Image[];
  videos: Video[];
  isStreaming: boolean;
  searchResults?: SearchResult[];
  conditionalFunctionCallUI?: any;
  status?: string;
  places?: Place[];
  shoppings?: Shopping[];
  ticker?: string | undefined;
}

interface FollowUp {
  choices: {
    message: {
      content: string;
    }
  }[];
}

interface Image {
  link: string;
}

interface Video {
  link: string;
  imageUrl: string;
}

interface SearchResult {
  link: string;
  title: string;
  favicon: string;
}

interface Place {
  cid: React.Key | null | undefined;
  latitude: number;
  longitude: number;
  title: string;
  address: string;
  rating: number;
  category: string;
  phoneNumber?: string;
  website?: string;
}

interface Shopping {
  type: string;
  title: string;
  source: string;
  link: string;
  price: string;
  shopping: any;
  position: number;
  delivery: string;
  imageUrl: string;
  rating: number;
  ratingCount: number;
  offers: string;
  productId: string;
}

interface TestMessage {
  id: number;
  type: string;
  content: string;
}


export default function Home() {

  // 3. Set up action that will be used to stream all the messages
  const { myAction } = useActions<typeof AI>();

  // 4. Set up form submission handling
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 5. Set up state for the messages
  const [messages, setMessages] = useState<Message[]>([]);

  // 6. Set up state for the CURRENT LLM response (for displaying in the UI while streaming)
  const [currentLLMResponse, setCurrentLLMResponse] = useState('');

  // 7. Set up handler for when the user clicks on the follow up button
  const handleFollowUpClick = useCallback(async (question: string) => {
    setCurrentLLMResponse('');
    await handleUserMessageSubmission(question);

  }, []);
  // 8. For the form submission, we need to set up a handler that will be called when the user submits the form
  // 9. Set up handler for when a submission is made, which will call the myAction function
  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const messageToSend = inputValue.trim();
    if (!messageToSend) return;
    setInputValue("");
    await handleUserMessageSubmission(messageToSend);
  };

  const handleUserMessageSubmission = async (userMessage: string): Promise<void> => {

  };

  return (
    <div>
      <div>
        <div>
          {messages.length === 0 && (
            <InitialQueries
              questions={['How is Apple\'s stock doing these days?', 'Where can I get the best bagel in NYC?', 'I want to buy a mens patagonia vest']}
              handleFollowUpClick={handleFollowUpClick} />
          )}
          <form
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              handleFormSubmit(e);
              setCurrentLLMResponse("");
            }}
          >
            <div className='relative flex flex-col w-full overflow-hidden max-h-60 grow dark:bg-slate-800 bg-gray-100 rounded-md border sm:px-2'>
              <Textarea
                // ref={inputRef}
                // onKeyDown={ }
                placeholder='Send a message.'
                className='w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm dark:text-white text-black pr-[45px]'
                rows={1}
                autoFocus
                tabIndex={0}
                spellCheck={false}
                autoComplete='off'
                autoCorrect='off'
                name='message'
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <div className='absolute right-5 top-4'>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type='submit' size='icon' disabled={inputValue === ''}>
                      <ArrowUp />
                      <span className='sr-only'>Send message</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send message</TooltipContent>
                </Tooltip>
              </div>
            </div>

          </form>
        </div>
        <button
          onClick={async () => {
            const { status } = await runThread();
            for await (const value of readStreamableValue(status)) {
              const typedValue = value as TestMessage;
              console.log(typedValue);
            }
          }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}
