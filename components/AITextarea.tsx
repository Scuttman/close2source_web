"use client";
import { useState } from 'react';
import { improveTextWithAI, makeTextShorter, makeTextLonger } from '../src/lib/ai';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { useAIConsent } from '../src/lib/aiContext';

interface AITextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  aiContext?: string;
}

export default function AITextarea({ 
  value, 
  onChange, 
  placeholder, 
  className = '',
  rows = 4,
  aiContext 
}: AITextareaProps) {
  const { aiEnabled } = useAIConsent();
  const [showMenu, setShowMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [improvedText, setImprovedText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [error, setError] = useState('');

  const handleAIAction = async (action: 'improve' | 'shorter' | 'longer') => {
    if (!value.trim()) {
      setError('Please enter some text first');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setShowMenu(false);
    setIsProcessing(true);
    setError('');
    setOriginalText(value);

    try {
      let result = '';
      switch (action) {
        case 'improve':
          result = await improveTextWithAI(value, aiContext);
          break;
        case 'shorter':
          result = await makeTextShorter(value);
          break;
        case 'longer':
          result = await makeTextLonger(value);
          break;
      }
      
      setImprovedText(result);
      setShowPreview(true);
    } catch (err) {
      setError('Failed to improve text. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyImprovedText = () => {
    onChange(improvedText);
    setShowPreview(false);
    setImprovedText('');
    setOriginalText('');
  };

  const cancelPreview = () => {
    setShowPreview(false);
    setImprovedText('');
    setOriginalText('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`${className} ${aiEnabled ? 'pr-12' : ''}`}
        />
        
        {/* AI Button — only shown when user has AI consent */}
        {aiEnabled && value.trim() && !isProcessing && (
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="absolute top-2 right-2 p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all shadow-md"
            title="Improve with AI"
          >
            <SparklesIcon className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Loading Spinner */}
        {aiEnabled && isProcessing && (
          <div className="absolute top-2 right-2 p-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* AI Action Menu */}
      {aiEnabled && showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="p-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-purple-500" />
                AI Text Assistant
              </h3>
            </div>
            <div className="py-1">
              <button
                onClick={() => handleAIAction('improve')}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start gap-3"
              >
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <SparklesIcon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Improve Text</div>
                  <div className="text-xs text-gray-500">Fix grammar, spelling, and clarity</div>
                </div>
              </button>
              <button
                onClick={() => handleAIAction('shorter')}
                className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors flex items-start gap-3"
              >
                <div className="p-1.5 bg-orange-100 rounded-lg">
                  <span className="text-sm font-bold text-orange-600">⚡</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Make Shorter</div>
                  <div className="text-xs text-gray-500">More concise, keep key points</div>
                </div>
              </button>
              <button
                onClick={() => handleAIAction('longer')}
                className="w-full px-4 py-3 text-left hover:bg-green-50 transition-colors flex items-start gap-3"
              >
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <span className="text-sm font-bold text-green-600">📝</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Make Longer</div>
                  <div className="text-xs text-gray-500">Add more detail and explanation</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-blue-500" />
                AI Suggestion
              </h2>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-2">Original:</div>
                  <div className="p-4 bg-gray-100 rounded-lg border border-gray-300 text-gray-700 whitespace-pre-wrap">
                    {originalText}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" />
                    AI Improved: <span className="font-normal text-gray-500 text-xs">(edit before accepting)</span>
                  </div>
                  <textarea
                    value={improvedText}
                    onChange={(e) => setImprovedText(e.target.value)}
                    rows={Math.max(6, improvedText.split('\n').length + 2)}
                    className="w-full p-4 bg-blue-50 rounded-lg border border-blue-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-y whitespace-pre-wrap"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={cancelPreview}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyImprovedText}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Use This
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
