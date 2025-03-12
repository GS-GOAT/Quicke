import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (res.error) {
      setError('Invalid credentials');
    } else {
      router.push('/');
    }
  };

  return (
    <>
      <Head>
        <title>Sign In - Quicke</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 px-4">
        <div className="w-full max-w-md">
          {/* Logo and Title */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="mx-auto h-12 w-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg mb-4 transform hover:rotate-6 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                <path d="M21.721 12.752a9.711 9.711 0 00-.945-5.003 12.754 12.754 0 01-4.339 2.708 18.991 18.991 0 01-.214 4.772 17.165 17.165 0 005.498-2.477zM14.634 15.55a17.324 17.324 0 00.332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 00.332 4.647 17.385 17.385 0 005.268 0zM9.772 17.119a18.963 18.963 0 004.456 0A17.182 17.182 0 0112 21.724a17.18 17.18 0 01-2.228-4.605z" />
              </svg>
            </div>
            <h2 className="mt-2 text-3xl font-bold text-white">Welcome back</h2>
            <p className="mt-2 text-sm text-gray-400">
              Sign in to continue to Quicke
            </p>
          </div>

          <div className="bg-gray-800 rounded-2xl shadow-xl overflow-hidden transform hover:scale-[1.01] transition-all duration-200 border border-gray-700/50">
            <div className="p-6 sm:p-8">
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-900/30 text-red-400 text-sm animate-shake">
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-3 rounded-lg font-medium shadow-sm hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  Sign in
                </button>
              </form>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link 
              href="/auth/signup" 
              className="font-medium text-primary-400 hover:text-primary-300 transition-colors duration-200"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
