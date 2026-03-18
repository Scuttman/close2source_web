"use client";
import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIReviewProfile {
  name?: string;
  bio?: string;
  story?: string;
  vision?: string;
  serviceLocation?: string;
  organization?: string;
  ministryDescription?: string;
  focusAreas?: string[];
  isFamily?: boolean;
  yearsInService?: number;
}

interface IndividualAIReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  individualId: string;
  currentData: AIReviewProfile;
  onUpdate: (updatedData: AIReviewProfile) => void;
}

const SYSTEM_PROMPT = `You are a helpful assistant helping missionaries, volunteers, and ministry workers improve their personal profiles. You will be shown their current profile and should help make it more compelling, clear, and authentic.

Your role:
1. Review the current profile fields
2. Suggest improvements to make their story and vision more compelling
3. Help articulate their calling and impact more clearly
4. Ensure the profile authentically represents their ministry

When you receive profile data, analyze it and provide constructive feedback. Ask clarifying questions to understand their ministry better before suggesting specific improvements.

When the user provides new or improved information, extract it into this JSON format:
{
  "name": "Full name or family name",
  "isFamily": true or false,
  "bio": "Brief summary (2-3 sentences)",
  "serviceLocation": "Where they serve",
  "organization": "Mission organization or church",
  "yearsInService": number,
  "vision": "Their vision statement",
  "story": "Their journey and calling story (2-4 paragraphs)",
  "ministryDescription": "What they do day-to-day",
  "focusAreas": ["area1", "area2", "area3"]
}

Always wrap your JSON in <profile></profile> tags. Only include fields that have been discussed or improved.`;

export default function IndividualAIReviewModal({ 
  isOpen, 
  onClose, 
  individualId,
  currentData,
  onUpdate 
}: IndividualAIReviewModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<AIReviewProfile | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize conversation with current profile data
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const currentDataSummary = `Current Profile Data:
${currentData.name ? `Name: ${currentData.name}` : ''}
${currentData.isFamily !== undefined ? `Type: ${currentData.isFamily ? 'Family' : 'Individual'}` : ''}
${currentData.bio ? `Bio: ${currentData.bio}` : ''}
${currentData.serviceLocation ? `Service Location: ${currentData.serviceLocation}` : ''}
${currentData.organization ? `Organization: ${currentData.organization}` : ''}
${currentData.yearsInService ? `Years in Service: ${currentData.yearsInService}` : ''}
${currentData.vision ? `Vision: ${currentData.vision}` : ''}
${currentData.story ? `Story: ${currentData.story}` : ''}
${currentData.ministryDescription ? `Ministry Description: ${currentData.ministryDescription}` : ''}
${currentData.focusAreas && currentData.focusAreas.length > 0 ? `Focus Areas: ${currentData.focusAreas.join(', ')}` : ''}`;

      // Load from localStorage if exists
      const storageKey = `ai_individual_review_${individualId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.messages && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
            setMessages(data.messages);
            if (data.profile) setCurrentProfile(data.profile);
            return;
          }
        } catch (e) {
          console.error('Failed to parse saved data:', e);
        }
      }

      // Initialize new conversation
      const initialMessage: Message = {
        role: 'assistant',
        content: `I've reviewed your profile and I'm here to help you make it even better. Here's what I see:\n\n${currentDataSummary}\n\nWhat would you like to improve or expand on? I can help you:\n• Craft a more compelling story\n• Clarify your vision\n• Better describe your ministry work\n• Highlight your impact and focus areas\n\nWhat area would you like to start with?`
      };

      setMessages([
        { role: 'system', content: SYSTEM_PROMPT },
        initialMessage
      ]);
    }
  }, [isOpen, individualId, messages.length, currentData]);

  // Save to localStorage
  useEffect(() => {
    if (messages.length > 1) {
      const storageKey = `ai_individual_review_${individualId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        messages,
        profile: currentProfile,
        timestamp: Date.now()
      }));
    }
  }, [messages, currentProfile, individualId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function sendMessage(userMessage: string) {
    if (!userMessage.trim() || isLoading) return;

    const newMessage: Message = { role: 'user', content: userMessage };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: updatedMessages,
          temperature: 0.7,
          max_tokens: 1000,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to get response from AI');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      // Add placeholder message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantText };
                return updated;
              });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      // Extract profile data if present
      const profileMatch = assistantText.match(/<profile>([\s\S]*?)<\/profile>/);
      if (profileMatch) {
        try {
          const profileData = JSON.parse(profileMatch[1]);
          setCurrentProfile(prev => ({ ...prev, ...profileData }));
        } catch (e) {
          console.error('Failed to parse profile JSON:', e);
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApplyImprovements() {
    if (!currentProfile || !individualId) return;

    setIsApplying(true);
    try {
      const individualRef = doc(db, 'individuals', individualId);
      await updateDoc(individualRef, currentProfile as any);
      
      // Update parent component
      onUpdate(currentProfile);
      
      // Clear localStorage
      localStorage.removeItem(`ai_individual_review_${individualId}`);
      
      alert('Profile improvements applied successfully!');
      onClose();
    } catch (error) {
      console.error('Error applying improvements:', error);
      alert('Failed to apply improvements. Please try again.');
    } finally {
      setIsApplying(false);
    }
  }

  function handleStartFresh() {
    if (confirm('Start a new conversation? Your current chat will be saved for later.')) {
      localStorage.removeItem(`ai_individual_review_${individualId}`);
      setMessages([]);
      setCurrentProfile(null);
      onClose();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-semibold text-gray-900">AI Profile Review</h2>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 2 && (
              <button
                onClick={handleStartFresh}
                className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                title="Start fresh conversation"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          {messages
            .filter(m => m.role !== 'system')
            .map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.content.replace(/<profile>[\s\S]*?<\/profile>/g, '').trim()}
                  </div>
                </div>
              </div>
            ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Apply button - inline in chat */}
          {currentProfile && !isLoading && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleApplyImprovements}
                disabled={isApplying}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isApplying ? 'Applying...' : 'Apply Improvements'}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you'd like to improve..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              disabled={isLoading || isApplying}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || isApplying}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
