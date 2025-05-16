import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const { error: queryError, callbackUrl } = router.query;

  useEffect(() => {
    if (queryError) {
      if (queryError === "OAuthAccountNotLinked") {
        setError("This email is already associated with an account using a different sign-in method. Please sign in with the original method.");
      } else if (queryError === "Callback") {
        setError("There was an issue during the Google Sign-In process. Please try again.");
      } else {
        setError("Sign-in failed. Please check your credentials or try a different method.");
      }
    }
  }, [queryError]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: callbackUrl || '/',
    });

    if (res.error) {
      setError(res.error === "CredentialsSignin" ? 'Invalid email or password.' : 'Sign-in failed.');
      setIsLoading(false);
    } else if (res.url) {
      router.push(res.url);
    } else {
      router.push(callbackUrl || '/');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError('');
    try {
      await signIn('google', { 
        callbackUrl: callbackUrl || '/'
      });
    } catch (error) {
      setIsGoogleLoading(false);
      setError('Failed to connect to Google. Please try again.');
    }
  };

  return (
    <>
      <Head>
        <title>Sign In - Quicke</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center auth-bg px-4">
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <h2 className="mt-2 text-4xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Get responses from leading AI models
            </p>
          </div>

          <div className="backdrop-blur-xl bg-gray-900/50 rounded-2xl shadow-2xl overflow-hidden border border-gray-800/50">
            <div className="p-6 sm:p-8">
              {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-900/30 text-red-400 text-sm animate-shake">
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleCredentialsSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 rounded-lg text-white bg-gray-900/50 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    placeholder="name@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 rounded-lg text-white bg-gray-900/50 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isGoogleLoading}
                  className={`w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-3 rounded-lg font-medium shadow-sm hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 relative ${
                    isLoading ? 'cursor-not-allowed opacity-70' : ''
                  } ${isGoogleLoading ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              <div className="my-6 flex items-center">
                <div className="flex-grow border-t border-gray-600/50"></div>
                <span className="mx-4 flex-shrink text-xs text-gray-400">OR</span>
                <div className="flex-grow border-t border-gray-600/50"></div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
                className={`w-full px-4 py-3 flex items-center justify-center space-x-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-700/80 relative ${
                  isGoogleLoading ? 'cursor-not-allowed opacity-70' : ''
                } ${isLoading ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {isGoogleLoading ? (
                  <span className="inline-flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400">
                  Don't have an account?{' '}
                  <Link href="/auth/signup" className="text-primary-500 hover:text-primary-400 font-medium">
                    Sign up for free
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
