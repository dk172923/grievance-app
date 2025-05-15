'use client';
import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, PaperAirplaneIcon, AcademicCapIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Message, MessageRole, UserRole } from '@/types/chat';

interface AIAssistantProps {
  userRole?: UserRole;
}

export default function AIAssistant({ userRole = 'user' }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTypingResponse, setCurrentTypingResponse] = useState<string | null>(null);
  const [displayedTypingText, setDisplayedTypingText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingIndexRef = useRef<number>(0);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('ai_assistant_messages');
    
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          setMessages(parsedMessages);
        } else {
          initializeDefaultMessage();
        }
      } catch (error) {
        console.error('Error parsing saved messages:', error);
        initializeDefaultMessage();
      }
    } else {
      initializeDefaultMessage();
    }
    
    // Set initial suggestions based on role
    setInitialSuggestions();
    
    // Cleanup typing animation on unmount
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, [userRole]);
  
  // Initialize with default welcome message
  const initializeDefaultMessage = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Welcome to the Grievance Portal AI Assistant! How can I help you today?`,
        timestamp: new Date(),
      },
    ]);
  };

  // Set initial suggestions based on user role
  const setInitialSuggestions = () => {
    if (userRole === 'admin') {
      setSuggestions([
        'Analytics overview',
        'User management',
        'System settings'
      ]);
    } else if (userRole === 'employee') {
      setSuggestions([
        'Assigned grievances',
        'How to delegate tasks',
        'Notification settings'
      ]);
    } else {
      setSuggestions([
        'Submit a grievance',
        'Track my grievances',
        'Upload a document'
      ]);
    }
  };

  // Save messages to localStorage when messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ai_assistant_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to the bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayedTypingText]);

  // Focus on input when chat is opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle typing animation
  useEffect(() => {
    if (currentTypingResponse) {
      // Start typing animation
      typingIndexRef.current = 0;
      setDisplayedTypingText('');
      
      // Clear any existing interval
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      
      // Create new typing interval
      typingIntervalRef.current = setInterval(() => {
        // If we've typed the entire message
        if (typingIndexRef.current >= currentTypingResponse.length) {
          // Clear the interval
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
          }
          
          // Add the message to history
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: currentTypingResponse,
              timestamp: new Date()
            }
          ]);
          
          // Clear typing state
          setCurrentTypingResponse(null);
          setDisplayedTypingText('');
          return;
        }
        
        // Add the next character
        typingIndexRef.current++;
        setDisplayedTypingText(currentTypingResponse.substring(0, typingIndexRef.current));
      }, 15);
    }
    
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, [currentTypingResponse]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Welcome to the Grievance Portal AI Assistant! How can I help you today?`,
        timestamp: new Date(),
      },
    ]);
    localStorage.removeItem('ai_assistant_messages');
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    handleSendMessage(suggestion);
  };

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputValue.trim();
    if (messageText === '') return;
    if (isLoading || currentTypingResponse) return;

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      // Call the API with the user's message
      const response = await fetch('/api/chat-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          userRole,
          chatHistory: messages.slice(-5).map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from assistant');
      }

      const data = await response.json();
      
      // Update suggestions if provided by the API
      if (data.suggestedQuestions && Array.isArray(data.suggestedQuestions)) {
        setSuggestions(data.suggestedQuestions);
      } else {
        // Generate new suggestions based on the context of the conversation if API doesn't provide any
        generateNewSuggestions(userMessage.content, data.response);
      }
      
      // Start typing animation with the response
      if (data.response) {
        setCurrentTypingResponse(data.response);
      } else {
        throw new Error('Empty response from assistant');
      }
    } catch (error) {
      console.error('Error generating response:', error);
      setError((error as Error).message || 'Something went wrong');
      
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again later.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate new suggestions based on conversation context
  const generateNewSuggestions = (query: string, response: string) => {
    const combinedText = query.toLowerCase() + ' ' + response.toLowerCase();
    
    if (combinedText.includes('submit') && combinedText.includes('grievance')) {
      setSuggestions(['What documents can I upload?', 'How is priority determined?', 'Can I submit anonymously?']);
    } else if (combinedText.includes('track') || combinedText.includes('status')) {
      setSuggestions(['How are notifications sent?', 'What do the status levels mean?', 'Who handles my grievance?']);
    } else if (combinedText.includes('document') || combinedText.includes('upload')) {
      setSuggestions(['What file types are supported?', 'Is there a file size limit?', 'How are documents analyzed?']);
    } else if (combinedText.includes('priority')) {
      setSuggestions(['How are high priority cases handled?', 'Can I change the priority?', 'What makes a case high priority?']);
    } else if (combinedText.includes('assign') || combinedText.includes('delegate')) {
      setSuggestions(['Who can see my grievance?', 'How long until someone responds?', 'Can I request a specific department?']);
    } else {
      // Default suggestions if no context match
      setInitialSuggestions();
    }
  };

  return (
    <>
      {/* Chat button */}
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-700 transition-all duration-300 z-50 flex items-center justify-center"
        aria-label="Open AI Assistant"
      >
        <AcademicCapIcon className="h-6 w-6" />
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200 animate-fade-in">
          {/* Header */}
          <div className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center">
            <h3 className="font-semibold">Grievance Portal AI Assistant</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearConversation}
                className="text-white hover:text-gray-200"
                title="Clear conversation"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
              <button onClick={toggleOpen} className="text-white hover:text-gray-200">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 ${
                  message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                }`}
              >
                <div
                  className={`max-w-[75%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Typing animation */}
            {currentTypingResponse && displayedTypingText && (
              <div className="flex justify-start mb-4">
                <div className="bg-white text-gray-800 border border-gray-200 p-3 rounded-lg rounded-bl-none max-w-[75%]">
                  <p className="text-sm whitespace-pre-wrap">{displayedTypingText}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )}
            
            {/* Loading indicator */}
            {isLoading && !currentTypingResponse && (
              <div className="flex justify-start mb-4">
                <div className="bg-white text-gray-800 border border-gray-200 p-3 rounded-lg rounded-bl-none max-w-[75%]">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Error message */}
            {error && (
              <div className="p-2 mb-2 bg-red-50 text-red-500 rounded text-sm text-center">
                {error}
              </div>
            )}
            
            {/* Suggestions */}
            {suggestions.length > 0 && !isLoading && !currentTypingResponse && (
              <div className="mt-2 mb-2 flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="bg-indigo-50 text-indigo-700 text-xs py-1 px-2 rounded-full hover:bg-indigo-100 transition-colors border border-indigo-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex items-end">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your question here..."
                disabled={!!(isLoading || currentTypingResponse)}
                className={`flex-1 border border-gray-300 rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-10 max-h-32 min-h-10 ${
                  isLoading || currentTypingResponse ? 'bg-gray-100' : ''
                }`}
                style={{ height: Math.min(Math.max(inputValue.split('\n').length * 20, 40), 120) }}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!!(isLoading || currentTypingResponse || inputValue.trim() === '')}
                className={`bg-indigo-600 text-white p-2 rounded-r-lg h-10 ${
                  isLoading || currentTypingResponse || inputValue.trim() === '' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'
                }`}
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">
                Press Enter to send, Shift+Enter for new line
              </p>
              {userRole !== 'user' && (
                <p className="text-xs text-indigo-600 font-medium">
                  Mode: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 