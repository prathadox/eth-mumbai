"use client";

import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { useCallback, useEffect, useRef, useState } from "react";

const TOKEN_KEY = "penguin_jwt";

// Module-level singleton so all hook instances share the same state
let _token: string | null = null;
const _listeners = new Set<(t: string | null) => void>();

function setGlobalToken(t: string | null) {
  _token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
  _listeners.forEach((fn) => fn(t));
}

// Init from storage once
if (typeof window !== "undefined") {
  _token = localStorage.getItem(TOKEN_KEY);
}

export function useSiweAuth() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(_token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevAddress = useRef<string | undefined>(undefined);

  // Subscribe to singleton updates
  useEffect(() => {
    const listener = (t: string | null) => setToken(t);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  // Clear token when wallet disconnects or address changes
  useEffect(() => {
    if (prevAddress.current !== undefined && address !== prevAddress.current) {
      setGlobalToken(null);
    }
    prevAddress.current = address;
  }, [address]);

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;
    setLoading(true);
    setError(null);
    try {
      const nonceRes = await fetch(`/api/auth/nonce?address=${address}`, { cache: "no-store" });
      const data = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(data.error ?? "Failed to get nonce");

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Penguin Protocol",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce: data.nonce,
      });

      const prepared = message.prepareMessage();
      const signature = await signMessageAsync({ message: prepared });

      const authRes = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prepared, signature }),
      });

      const { token: jwt, error: authError } = await authRes.json();
      if (authError) throw new Error(authError);

      setGlobalToken(jwt);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(() => {
    setGlobalToken(null);
  }, []);

  const authFetch = useCallback(
    (url: string, options: RequestInit = {}) =>
      fetch(url, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          "Content-Type": "application/json",
          Authorization: `Bearer ${_token}`,
        },
      }),
    []
  );

  return { token, loading, error, signIn, signOut, authFetch, isSignedIn: !!token };
}
