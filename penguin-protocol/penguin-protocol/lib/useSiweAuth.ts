"use client";

import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "penguin_jwt";

export function useSiweAuth() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
  }, []);

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;
    setLoading(true);
    setError(null);

    try {
      const nonceRes = await fetch(`/api/auth/nonce?address=${address}`, { cache: "no-store" });
      const data = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(data.error ?? "Failed to get nonce");
      const { nonce } = data;

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Penguin Protocol",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });

      const signature = await signMessageAsync({ message: message.prepareMessage() });

      const authRes = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.prepareMessage(), signature }),
      });

      const { token: jwt, error: authError } = await authRes.json();
      if (authError) throw new Error(authError);

      localStorage.setItem(TOKEN_KEY, jwt);
      setToken(jwt);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  const authFetch = useCallback(
    (url: string, options: RequestInit = {}) => {
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [token]
  );

  return { token, loading, error, signIn, signOut, authFetch, isSignedIn: !!token };
}
