"use client";

/**
 * aiContext.tsx
 *
 * Provides the current user's AI consent status to all components via
 * React context.  Reads the `aiConsent` field from the `users/{uid}`
 * Firestore document in real time so that a Settings toggle takes effect
 * immediately without requiring a page reload.
 *
 * Usage:
 *   const { aiEnabled, loading } = useAIConsent();
 *   if (!aiEnabled) return null; // hide AI feature
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from './firebase';
import { subscribeUser } from '@/lib/dal';

// ─── Context ──────────────────────────────────────────────────────────────────

interface AIConsentContextValue {
  /** True when the user has explicitly opted in to AI features. */
  aiEnabled: boolean;
  /** True while the auth / Firestore state is still loading. */
  loading: boolean;
}

const AIConsentContext = createContext<AIConsentContextValue>({
  aiEnabled: false,
  loading: true,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AIConsentProvider({ children }: { children: React.ReactNode }) {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    let unsubDoc: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubDoc) { unsubDoc(); unsubDoc = undefined; }

      if (user) {
        // Real-time listener on the user doc via DAL
        unsubDoc = subscribeUser(
          user.uid,
          (userData) => {
            setAiEnabled(userData?.aiConsent === true);
            setLoading(false);
          },
          () => {
            setAiEnabled(false);
            setLoading(false);
          }
        );
      } else {
        setAiEnabled(false);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  return (
    <AIConsentContext.Provider value={{ aiEnabled, loading }}>
      {children}
    </AIConsentContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIConsent(): AIConsentContextValue {
  return useContext(AIConsentContext);
}
