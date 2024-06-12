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
import { error } from 'console';
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
  shopping?: Shopping[];
  ticker?: string | undefined;
}

interface StreamMessage {
  userMessage?: string;
  followUp?: any;
  images?: any;
  videos?: any;
  searchResults?: any;
  conditionalFunctionCallUI?: any;
  status?: string;
  places?: Place[];
  shopping?: Shopping[];
  ticker?: string;
  llmResponse?: string;
  llmResponseEnd?: boolean;
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
  const { formRef, onKeyDown } = useEnterSubmit();

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
  useEffect(() => {

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {

        if (
          e.target && ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).nodeName)
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        inputRef?.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [inputRef]);

  // 9. Set up handler for when a submission is made, which will call the myAction function
  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const messageToSend = inputValue.trim();
    if (!messageToSend) return;
    setInputValue("");
    await handleUserMessageSubmission(messageToSend);
  };

  const handleUserMessageSubmission = async (userMessage: string): Promise<void> => {
    const newMessageId = Date.now();
    const newMessage = {
      id: newMessageId,
      type: 'userMessage',
      content: '',
      userMessage: userMessage,
      followUp: null,
      images: [],
      videos: [],
      isStreaming: true,
      searchResults: [],
      status: '',
      places: [],
      shoppings: [],
      ticker: undefined,
    };

    setMessages(prevMessages => [...prevMessages, newMessage]);

    try {
      let lastAppendedResponse = '';
      const streamableValue = await myAction(userMessage);

      for await (const message of readStreamableValue(streamableValue)) {
        const typedMessage = message as StreamMessage;
        setMessages((prevMessages) => {
          const messagesCopy = [...prevMessages];
          const messageIndex = messagesCopy.findIndex(msg => msg.id === newMessageId);

          if (messageIndex !== -1) {
            const currentMessage = messagesCopy[messageIndex];
            currentMessage.status = typedMessage.status === 'rateLimitReached' ? 'rateLimitReached' : currentMessage.status;

            if (typedMessage.llmResponse && typedMessage.llmResponse !== lastAppendedResponse) {
              currentMessage.content += typedMessage.llmResponse;
              lastAppendedResponse = typedMessage.llmResponse;
            }

            currentMessage.isStreaming = typedMessage.llmResponseEnd ? false : currentMessage.isStreaming;
            currentMessage.searchResults = typedMessage.searchResults || currentMessage.searchResults;
            currentMessage.images = typedMessage.images ? [...typedMessage.images] : currentMessage.images;
            currentMessage.videos = typedMessage.videos ? [...typedMessage.videos] : currentMessage.videos;
            currentMessage.followUp = typedMessage.followUp || currentMessage.followUp;

            // if (typedMessage.conditionalFunctionCallUI) {
            //   const functionCall = typedMessage.conditionalFunctionCallUI;
            //   if (functionCall.type === 'places') currentMessage.places = functionCall.places;
            //   if (functionCall.type === 'shopping') currentMessage.shopping = functionCall.shopping;
            //   if (functionCall.type === 'ticker') currentMessage.ticker = functionCall.data;
            // }

            if (typedMessage.conditionalFunctionCallUI) {
              const functionCall = typedMessage.conditionalFunctionCallUI;
              switch (functionCall.type) {
                case 'places': {
                  currentMessage.places = functionCall.places;
                  break;
                };
                case 'shopping': {
                  currentMessage.shopping = functionCall.shopping;
                  break;
                };
                case 'ticker': {
                  currentMessage.ticker = functionCall.data;
                  break;
                };
              }
            }

          }


          return messagesCopy;
        });

        let llmResponseString = '';
        if (typedMessage.llmResponse) {
          llmResponseString += typedMessage.llmResponse;
        }
      }
    } catch (err) {
      console.error("Error streaming data for user message: ", err);
    }
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
            ref={formRef}
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              handleFormSubmit(e);
              setCurrentLLMResponse("");
              if (window.innerWidth < 600) {
                (e.target as HTMLFormElement)['message']?.blur();
              }
            }}
          >
            <div className='relative flex flex-col w-full overflow-hidden max-h-60 grow dark:bg-slate-800 bg-gray-100 rounded-md border sm:px-2'>
              <Textarea
                ref={inputRef}
                onKeyDown={onKeyDown}
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
