/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { StaffProfile, UserProfile, UserRole } from '../types';
import { getMyRole, getStaffByEmail, upsertProfile } from './api';
import { logAuditEvent } from './auditLogger';
import { seedInitialDatabaseIfNeeded } from './seedData';
import { supabase } from './supabase';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  staffProfile: StaffProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  unauthorizedMessage: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshStaffProfile: () => Promise<StaffProfile | null>;
  clearUnauthorizedMessage: () => void;
  // Dev simulation helper for testing distinct personas easily in the preview
  simulatePersona: (personaEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Dev persona simulator only. Real roles are resolved by public.my_role() in the database.
const SIMULATED_SUPER_ADMIN_EMAILS = ['ceo@topclues.in', 'dbagada910@gmail.com'];
const SIMULATED_HR_EMAILS = ['unicorn@topclues.in', 'marketing@topclues.in'];

let seedAttempted = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null);
  const processedUserId = useRef<string | null>(null);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        processedUserId.current = null;
        setCurrentUser(null);
        setUserProfile(null);
        setStaffProfile(null);
        setRole(null);
        setIsLoading(false);
        return;
      }

      if (
        session?.user &&
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') &&
        processedUserId.current !== session.user.id
      ) {
        processedUserId.current = session.user.id;
        void processAuthenticatedUser(session.user);
      } else if (!session) {
        setIsLoading(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function processAuthenticatedUser(user: User, simulatedEmail?: string) {
    setIsLoading(true);
    setUnauthorizedMessage(null);

    const email = (simulatedEmail || user.email || '').trim().toLowerCase();

    if (!email) {
      await supabase.auth.signOut();
      setUnauthorizedMessage('Could not resolve a verified email from your Google account.');
      setIsLoading(false);
      return;
    }

    try {
      let resolvedRole: UserRole | null = null;

      if (simulatedEmail) {
        if (SIMULATED_SUPER_ADMIN_EMAILS.includes(email)) {
          resolvedRole = 'SUPER_ADMIN';
        } else if (SIMULATED_HR_EMAILS.includes(email)) {
          resolvedRole = 'HR';
        }
      } else {
        resolvedRole = await getMyRole();
      }

      let matchedStaff: StaffProfile | null = null;
      try {
        matchedStaff = await getStaffByEmail(email);
      } catch (err) {
        console.warn('Staff lookup note:', err);
      }

      if (matchedStaff) {
        if (matchedStaff.status === 'Inactive' || matchedStaff.status === 'Left') {
          await logAuditEvent({
            actorUid: user.id,
            actorEmail: email,
            actorRole: 'STAFF',
            action: 'LOGIN_DENIED_DEACTIVATED',
            entityType: 'AUTH',
            entityId: matchedStaff.id,
            details: `Deactivated staff (${matchedStaff.status}) attempted login. Access revoked.`,
          });
          await supabase.auth.signOut();
          setUnauthorizedMessage('Your staff account is currently inactive or deactivated. Please contact Topclues Solutions HR.');
          setIsLoading(false);
          return;
        }

        if (!resolvedRole) {
          resolvedRole = 'STAFF';
        }
      }

      if (!resolvedRole) {
        await logAuditEvent({
          actorUid: user.id,
          actorEmail: email,
          actorRole: 'SYSTEM',
          action: 'LOGIN_DENIED_UNAUTHORIZED',
          entityType: 'AUTH',
          entityId: user.id,
          details: `Unauthorized login attempt with email: ${email}`,
        });
        await supabase.auth.signOut();
        setUnauthorizedMessage('Your account is not authorized. Please contact Topclues Solutions HR.');
        setIsLoading(false);
        return;
      }

      const profile: UserProfile = {
        uid: user.id,
        email,
        displayName:
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          email.split('@')[0],
        photoURL:
          (user.user_metadata?.avatar_url as string | undefined) ||
          (user.user_metadata?.picture as string | undefined),
        role: resolvedRole,
        staffId: matchedStaff?.id,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      try {
        await upsertProfile(profile);
      } catch (err) {
        console.warn('Profile sync note:', err);
      }

      await logAuditEvent({
        actorUid: user.id,
        actorEmail: email,
        actorRole: resolvedRole,
        action: 'LOGIN_SUCCESS',
        entityType: 'AUTH',
        entityId: user.id,
        details: `Successful sign in with role: ${resolvedRole}`,
      });

      if (resolvedRole === 'SUPER_ADMIN' && !seedAttempted && !simulatedEmail) {
        seedAttempted = true;
        await seedInitialDatabaseIfNeeded();
      }

      setCurrentUser(user);
      setUserProfile(profile);
      setStaffProfile(matchedStaff);
      setRole(resolvedRole);
    } catch (err) {
      console.error('Error processing user:', err);
      setUnauthorizedMessage('An error occurred while verifying your account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshStaffProfile(): Promise<StaffProfile | null> {
    if (!currentUser || currentUser.id.startsWith('sim_')) return staffProfile;
    const email = (currentUser.email || '').trim().toLowerCase();
    if (!email) return staffProfile;

    try {
      const refreshed = await getStaffByEmail(email);
      setStaffProfile(refreshed);
      if (refreshed && refreshed.status !== 'Active') {
        setUnauthorizedMessage(
          'Your staff account is no longer active. Please contact Topclues Solutions HR.'
        );
        await supabase.auth.signOut();
      }
      return refreshed;
    } catch (err) {
      console.warn('Staff profile refresh failed:', err);
      return staffProfile;
    }
  }

  async function signIn() {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      console.error('Google Sign In Error:', error);
      setUnauthorizedMessage(`Google sign-in failed: ${error.message}`);
      setIsLoading(false);
    }
    // On success the browser redirects to Google and returns to this origin,
    // where onAuthStateChange picks up the session.
  }

  async function signOutUser() {
    if (currentUser && userProfile) {
      await logAuditEvent({
        actorUid: currentUser.id,
        actorEmail: userProfile.email,
        actorRole: userProfile.role,
        action: 'LOGOUT',
        entityType: 'AUTH',
        entityId: currentUser.id,
        details: 'User logged out',
      });
    }
    await supabase.auth.signOut();
  }

  // Developer simulation function to test any role in the UI
  async function simulatePersona(personaEmail: string) {
    const mockUser = {
      id: `sim_${personaEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: personaEmail,
      user_metadata: { full_name: personaEmail.split('@')[0] },
      app_metadata: { provider: 'google' },
    } as unknown as User;

    if (!currentUser) {
      await processAuthenticatedUser(mockUser, personaEmail);
    } else {
      await processAuthenticatedUser(currentUser, personaEmail);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        staffProfile,
        role,
        isLoading,
        unauthorizedMessage,
        signIn,
        signOutUser,
        refreshStaffProfile,
        clearUnauthorizedMessage: () => setUnauthorizedMessage(null),
        simulatePersona,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
