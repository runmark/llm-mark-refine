
// 1. Define the 'LLMResponseComponentProps' interface with properties for 'llmResponse', 'currentLlmResponse', 'index', and 'semanticCacheKey'
// 2. Import the 'Markdown' component from 'react-markdown'
// 3. Define the 'StreamingComponent' functional component that renders the 'currentLlmResponse'
// 4. Define the 'LLMResponseComponent' functional component that takes 'llmResponse', 'currentLlmResponse', 'index', and 'semanticCacheKey' as props
// 5. Check if 'llmResponse' is not empty
// 6. If 'llmResponse' is not empty, render a div with the 'Markdown' component
// 7. If 'llmResponse' is empty, render the 'StreamingComponent' with 'currentLlmResponse'

type Props = {
    llmResponse: string;
    currentLlmResponse: string;
    index: number;
    semanticCacheKey: string;
};

const StreamingComponent = ({ currentLlmResponse }: { currentLlmResponse: string }) => {
    return (
        <>
            {currentLlmResponse && (
                <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4">
                    <div className="flex items-center">
                        <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">Answer</h2>
                        <img src="./groq.png" alt="groq logo" className='w-6 h-6' />
                    </div>
                    <div className="dark:text-gray-300 text-gray-800">{currentLlmResponse}</div>
                </div>
            )}
        </>
    );
};

const LLMResponseComponent = ({ llmResponse, currentLlmResponse, index, semanticCacheKey }: Props) => {
    return (
        <div>
            Enter
        </div>
    );
}

export default LLMResponseComponent;