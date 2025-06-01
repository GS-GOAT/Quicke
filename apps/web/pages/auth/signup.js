import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const { callbackUrl } = router.query;

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const signInRes = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });
        if (signInRes && signInRes.ok) {
          router.push('/onboarding');
        } else {
          setError(signInRes.error || 'Signed up, but failed to auto-login. Please try signing in.');
          setIsLoading(false);
        }
      } else {
        const data = await res.json();
        setError(data.error || 'Signup failed. This email might already be in use.');
        setIsLoading(false);
      }
    } catch (error) {
      setError('An unexpected error occurred during signup.');
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setError('');
    await signIn('google', {
      callbackUrl: callbackUrl || '/onboarding'
    });
  };

  return (
    <>
      <Head>
        <title>Sign Up - Quicke</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#101010] p-4 selection:bg-primary-500 selection:text-white">
        <div className="absolute top-6 left-6 flex items-center z-20">
          <img src="/logo.jpeg" alt="Quicke Logo" className="h-8 w-auto mr-2" />
          <span className="text-xl font-bold text-white">Quicke</span>
        </div>
        <div className="w-full max-w-xs sm:max-w-sm relative z-10">
          <div className="bg-[#1D1D1E] rounded-xl shadow-2xl p-8 space-y-7">
            <div className="text-center mb-2">
              <h2 className="text-3xl font-semibold text-white">
                Create your Account
              </h2>
              <p className="mt-2.5 text-sm text-gray-400">
                Get started with Quicke
              </p>
            </div>
            {error && (
              <div className="p-3.5 rounded-md bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                <p>{error}</p>
              </div>
            )}
            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
              <div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 rounded-md text-sm text-white bg-[#2C2C2E] border border-[#3A3A3C] focus:outline-none focus:border-primary-500 placeholder-gray-500 transition-colors"
                  placeholder="Email"
                />
              </div>
              <div>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 rounded-md text-sm text-white bg-[#2C2C2E] border border-[#3A3A3C] focus:outline-none focus:border-primary-500 placeholder-gray-500 transition-colors"
                  placeholder="Password"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className={`w-full bg-white hover:bg-gray-200 text-black py-2.5 text-sm rounded-md font-semibold shadow-sm transition-colors duration-150 relative ${
                  (isLoading || isGoogleLoading) ? 'cursor-not-allowed opacity-60' : ''
                }`}
              >
                {isLoading ? (
                   <span className="flex items-center justify-center">
                    <svg className="animate-spin mr-2 h-4 w-4 text-black" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Creating account...
                  </span>
                ) : 'Create Account'}
              </button>
            </form>
            <div className="my-5 flex items-center">
              <div className="flex-grow border-t border-[#3A3A3C]"></div>
              <span className="mx-3.5 flex-shrink text-xs text-gray-500">OR</span>
              <div className="flex-grow border-t border-[#3A3A3C]"></div>
            </div>
            <button
              onClick={handleGoogleSignUp}
              disabled={isLoading || isGoogleLoading}
              className={`w-full px-4 py-2.5 text-sm flex items-center justify-center bg-[#2C2C2E] hover:bg-[#363638] text-gray-200 rounded-md transition-colors duration-150 border border-[#3A3A3C] font-medium relative ${
                (isLoading || isGoogleLoading) ? 'cursor-not-allowed opacity-60' : ''
              }`}
            >
              {isGoogleLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin mr-2 h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing...
                </span>
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </button>
            <div className="mt-7 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/auth/signin" className="text-gray-300 hover:text-white hover:underline font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
