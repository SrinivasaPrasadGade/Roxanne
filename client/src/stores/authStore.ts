import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, isFirebaseConfigured } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  login: (user: User) => void;
  logout: () => void;
  syncUserProfile: (user: User) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isAuthModalOpen: false,
      setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
      login: (user) => set({ user, isAuthenticated: true, isAuthModalOpen: false }),
      logout: () => set({ user: null, isAuthenticated: false }),
      syncUserProfile: async (user) => {
        if (!isFirebaseConfigured || !db) return false;
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (!userDocSnap.exists()) {
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL || '',
              firstSignIn: serverTimestamp(),
              lastSignIn: serverTimestamp(),
            });
            return true; // First time signing in!
          } else {
            await updateDoc(userDocRef, {
              lastSignIn: serverTimestamp(),
              displayName: user.displayName,
              photoURL: user.photoURL || '',
            });
            return false; // Returning user!
          }
        } catch (error) {
          console.error('Error syncing user profile with Firestore:', error);
          return false;
        }
      },
    }),
    {
      name: 'roxanne-auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
