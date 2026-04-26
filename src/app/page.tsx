'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [email, setEmail] = useState('test@obracash.com');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && !redirectedRef.current) {
        redirectedRef.current = true;
        router.replace('/dashboard');
      }
    };

    void syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && ['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION'].includes(event) && !redirectedRef.current) {
        redirectedRef.current = true;
        window.setTimeout(() => {
          router.push('/dashboard');
        }, 300);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    redirectedRef.current = false;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage('Error: ' + error.message);
      return;
    }
    setMessage('Login correcto. Redirigiendo...');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1a1a2e] px-4 text-[#e0e0e0]">
      <div className="w-full max-w-md rounded-2xl border border-[#0f3460] bg-[#16213e] p-8 shadow-2xl">
        <h1 className="mb-2 text-3xl font-semibold">Jarvis Workplace</h1>
        <p className="mb-6 text-sm text-[#a0a0a0]">Dashboard operativo independiente</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-[#0f3460] bg-[#0f1a31] p-3 text-sm outline-none" />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-[#0f3460] bg-[#0f1a31] p-3 text-sm outline-none" />
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#1D9E75] p-3 text-sm font-medium text-white disabled:opacity-60">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        {message ? <p className="mt-4 text-sm text-[#a0a0a0]">{message}</p> : null}
      </div>
    </main>
  );
}
