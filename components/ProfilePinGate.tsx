"use client";
import { useState } from 'react';
import { updateIndividual, fieldArrayUnion } from '@/lib/dal';

interface ProfilePinGateProps {
  individualId: string;
  correctPin: string;
  currentUserUid: string | null;
  onSuccess: () => void;
}

export default function ProfilePinGate({ individualId, correctPin, currentUserUid, onSuccess }: ProfilePinGateProps) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    
    if (pinInput.trim() !== correctPin) {
      setError('Incorrect PIN. Please try again.');
      setPinInput('');
      return;
    }

    setChecking(true);
    try {
      // If user is logged in, add them to authorized viewers
      if (currentUserUid) {
        await updateIndividual(individualId, {
          authorizedViewers: fieldArrayUnion(currentUserUid)
        } as any);
      }
      onSuccess();
    } catch (err) {
      setError('Failed to authorize. Please try again.');
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-200">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Protected Profile</h2>
          <p className="text-sm text-gray-600 text-center">
            This profile is protected. Please enter the PIN to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter PIN
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pinInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPinInput(val);
                setError('');
              }}
              placeholder="••••"
              maxLength={6}
              autoFocus
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={checking || pinInput.length < 4}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {checking ? 'Checking...' : 'Enter'}
          </button>
        </form>

        {!currentUserUid && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              💡 Tip: <a href="/login" className="text-red-600 hover:underline">Sign in</a> to save access and avoid entering the PIN again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
