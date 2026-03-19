"use client";
import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { updateProject } from '@/lib/dal';


interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIReviewProfile {
  name?: string;
  description?: string;
  locationName?: string;
  locationIntroduction?: string;
  locationDescription?: string;
  vision?: string;
  projectHeading?: string;
  projectSummary?: string;
  projectImpact?: string;
  targetCompletionDate?: string;
  totalBudget?: number;
  currency?: string;
  goals?: string[];
  beneficiaries?: string;
  oversight?: string;
  otherDetails?: string;
}

interface ProjectAIReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentData: AIReviewProfile;
  onUpdate: (updatedData: AIReviewProfile) => void;
}

const SYSTEM_PROMPT = `You are an expert project consultant helping to review and improve project proposals. You will be shown the current state of a project and should help improve the content to be more compelling, clear, and complete.

Your role:
1. Review the current project fields
2. Suggest improvements to make content more compelling and clear
3. Help fill in any missing or weak areas
4. Extract structured data when the user provides improvements

When you receive project data, analyze it and provide constructive feedback. Ask clarifying questions to understand the project better before suggesting specific improvements.

When the user provides new or improved information, extract it into this JSON format:
{
  "name": "Project name",
  "description": "Brief description",
  "locationName": "Location name",
  "locationIntroduction": "Introduction about the location",
  "locationDescription": "Detailed location description",
  "vision": "Project vision statement",
  "projectHeading": "Compelling project heading",
  "projectSummary": "2-3 paragraph project summary",
  "projectImpact": "Expected impact description",
  "targetCompletionDate": "YYYY-MM-DD or description",
  "totalBudget": number,
  "currency": "USD/EUR/GBP etc",
  "goals": ["goal 1", "goal 2"],
  "beneficiaries": "Who benefits from this project",
  "oversight": "Oversight and accountability measures",
  "otherDetails": "Any other relevant details"
}

Always wrap your JSON in <profile></profile> tags. Only include fields that have been discussed or improved.`;

export default function ProjectAIReviewModal({ 
  isOpen, 
  onClose, 
  projectId,
  currentData,
  onUpdate 
}: ProjectAIReviewModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<AIReviewProfile | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize conversation with current project data
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const currentDataSummary = `Current Project Data:
${currentData.name ? `Name: ${currentData.name}` : ''}
${currentData.description ? `Description: ${currentData.description}` : ''}
${currentData.locationName ? `Location: ${currentData.locationName}` : ''}
${currentData.locationIntroduction ? `Location Intro: ${currentData.locationIntroduction}` : ''}
${currentData.vision ? `Vision: ${currentData.vision}` : ''}
${currentData.projectHeading ? `Heading: ${currentData.projectHeading}` : ''}
${currentData.projectSummary ? `Summary: ${currentData.projectSummary}` : ''}
${currentData.projectImpact ? `Impact: ${currentData.projectImpact}` : ''}
${currentData.targetCompletionDate ? `Completion: ${currentData.targetCompletionDate}` : ''}
${currentData.totalBudget ? `Budget: ${currentData.currency || '$'}${currentData.totalBudget}` : ''}
${currentData.goals && currentData.goals.length > 0 ? `Goals: ${currentData.goals.join(', ')}` : ''}
${currentData.beneficiaries ? `Beneficiaries: ${currentData.beneficiaries}` : ''}
${currentData.oversight ? `Oversight: ${currentData.oversight}` : ''}
${currentData.otherDetails ? `Other Details: ${currentData.otherDetails}` : ''}`;

      const initialMessage: Message = {
        role: 'assistant',
        content: `I'm here to help review and improve your project proposal. I can see your current project data. What would you like to improve or what questions do you have about making your proposal more compelling?`
      };

      setMessages([
        { role: 'system', content: SYSTEM_PROMPT + '\n\n' + currentDataSummary },
        initialMessage
      ]);
    }
  }, [isOpen, currentData]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load from localStorage
  useEffect(() => {
    if (!isOpen || !projectId) return;
    const storageKey = `ai_project_review_${projectId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.messages) setMessages(data.messages);
        if (data.profile) setCurrentProfile(data.profile);
      } catch (e) {
        console.error('Failed to parse saved review data:', e);
      }
    }
  }, [isOpen, projectId]);

  // Save to localStorage
  useEffect(() => {
    if (!projectId || messages.length === 0) return;
    const storageKey = `ai_project_review_${projectId}`;
    localStorage.setItem(storageKey, JSON.stringify({
      messages,
      profile: currentProfile,
      timestamp: Date.now()
    }));
  }, [messages, currentProfile, projectId]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          stream: true,
          messages: [...messages, userMessage],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!response.ok || !response.body) throw new Error('API error ' + response.status);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      // Add blank assistant bubble
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
            const delta = JSON.parse(data).choices?.[0]?.delta?.content;
            if (delta) {
              assistantMessage += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                return updated;
              });
            }
          } catch (e) {
            // Skip invalid JSON chunks
          }
        }
      }

      // Extract profile data if present
      const profileMatch = assistantMessage.match(/<profile>([\s\S]*?)<\/profile>/);
      if (profileMatch) {
        try {
          const profileData = JSON.parse(profileMatch[1]);
          setCurrentProfile(prevProfile => ({
            ...prevProfile,
            ...profileData
          }));
        } catch (e) {
          console.error('Failed to parse profile data:', e);
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

  async function handleApply() {
    if (!currentProfile || !projectId) return;
    
    setIsApplying(true);
    try {
      // Update only the fields that have been reviewed/improved
      const updateData: any = {};
      Object.keys(currentProfile).forEach(key => {
        const value = currentProfile[key as keyof AIReviewProfile];
        if (value !== undefined && value !== null && value !== '') {
          updateData[key] = value;
        }
      });

      await updateProject(projectId, updateData as any);
      
      // Clear localStorage
      localStorage.removeItem(`ai_project_review_${projectId}`);
      
      // Notify parent component
      onUpdate(currentProfile);
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project. Please try again.');
    } finally {
      setIsApplying(false);
    }
  }

  function handleStartFresh() {
    if (confirm('Are you sure you want to start a new review conversation? Current progress will be saved.')) {
      localStorage.removeItem(`ai_project_review_${projectId}`);
      setMessages([]);
      setCurrentProfile(null);
      // Re-initialize will happen via useEffect
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-semibold text-gray-900">AI Project Review</h2>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 2 && (
              <button
                onClick={handleStartFresh}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Start fresh conversation"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
        >
          {messages
            .filter(m => m.role !== 'system')
            .map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 break-words ${
                    message.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.content.replace(/<profile>[\s\S]*?<\/profile>/g, '').trim()}
                </div>
              </div>
            ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Apply Button - inline in chat */}
          {currentProfile && Object.keys(currentProfile).length > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isApplying ? 'Updating Project...' : 'Apply Improvements'}
              </button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you'd like to improve..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
