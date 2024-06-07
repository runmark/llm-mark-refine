'use client';

import { useChat } from 'ai/react';

export default function Chat() {

    // useChat(): This package is framework agnostic 
    // and provides simple abstractions for quickly building chat - like interfaces with LLMs.
    // + app route
    const { messages, input, handleInputChange, handleSubmit, data } = useChat();

    return (
        <>
            <h1>Hello llm</h1>
            <div className='flex flex-col w-full max-w-md py-24 mx-auto stretch'>
                {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
                {messages.map((m) => (
                    <div key={m.id} className='whitespace-pre-wrap'>
                        {m.role === 'user' ? 'User: ' : 'AI: '}
                        {m.content}
                    </div>
                ))}
                <form onSubmit={handleSubmit}>
                    <input
                        className='fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl'
                        value={input}
                        placeholder="Say sth..."
                        onChange={handleInputChange}
                    />
                </form>
            </div>
        </>
    );
}
