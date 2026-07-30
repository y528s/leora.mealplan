/**
 * WHO AM I?
 *
 * Almost every screen needs to know three things: who is signed in, which
 * family they are in, and what they are allowed to do. Rather than every screen
 * asking the database separately, we load it once here and share it.
 *
 * This uses a React "context", which is basically a box you put data in at the
 * top of the app so anything underneath can reach in and grab it without it
 * being passed down by hand through every single component.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import type { Family, FamilyMember, Role } from './types';

type Store = {
  /** Still figuring out who is signed in — show a spinner, do not redirect yet. */
  loading: boolean;
  session: Session | null;
  family: Family | null;
  /** My own row in the family — my name, my role, my appetite. */
  me: FamilyMember | null;
  role: Role | null;
  /** Everyone in the family, including people who have not signed up yet. */
  members: FamilyMember[];
  /** Re-read everything from the database. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [me, setMe] = useState<FamilyMember | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);

  /** Load the signed-in person's family and everyone in it. */
  const loadFamily = useCallback(async (userId: string) => {
    // Which family am I in? (This app assumes one family per person, which is
    // true for now. If we ever support two, this becomes a picker.)
    const { data: myRows, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', userId)
      .limit(1);

    if (error || !myRows?.length) {
      setFamily(null);
      setMe(null);
      setMembers([]);
      return;
    }

    const myRow = myRows[0] as FamilyMember;
    setMe(myRow);

    // Grab the family and the full member list at the same time instead of
    // waiting for one then the other. Promise.all runs them together.
    const [famRes, memRes] = await Promise.all([
      supabase.from('families').select('*').eq('id', myRow.family_id).single(),
      supabase
        .from('family_members')
        .select('*')
        .eq('family_id', myRow.family_id)
        .order('created_at', { ascending: true }),
    ]);

    setFamily((famRes.data as Family) ?? null);
    setMembers((memRes.data as FamilyMember[]) ?? []);
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) {
      await loadFamily(data.session.user.id);
    } else {
      setFamily(null);
      setMe(null);
      setMembers([]);
    }
    setLoading(false);
  }, [loadFamily]);

  useEffect(() => {
    refresh();

    if (!isSupabaseConfigured) return;

    // Supabase tells us when somebody signs in or out — including in another
    // tab or when a saved session expires. We react instead of polling.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadFamily(newSession.user.id);
      } else {
        setFamily(null);
        setMe(null);
        setMembers([]);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [refresh, loadFamily]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // useMemo stops every screen from re-rendering on every keystroke somewhere
  // else in the app. The value only changes when something in it changes.
  const value = useMemo<Store>(
    () => ({
      loading,
      session,
      family,
      me,
      role: me?.role ?? null,
      members,
      refresh,
      signOut,
    }),
    [loading, session, family, me, members, refresh, signOut]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
