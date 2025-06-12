import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const Auth = ({ onSignIn }) => {
  console.log('Auth component rendering');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async (e) => {
    console.log('Attempting sign in with username:', username);
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isNewUser) {
        // Validate passwords match
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        // Check if username already exists
        const { data: existingUser } = await supabase
          .from('players')
          .select('username')
          .eq('username', username)
          .single();

        if (existingUser) {
          throw new Error('Username already taken');
        }

        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from('players')
          .insert([
            {
              username: username,
              password: password, // In a real app, you should hash the password
              elo_rating: 1000,
              games_played: 0,
              games_won: 0,
              best_diagnostic_score: null
            }
          ])
          .select()
          .single();

        if (createError) throw createError;
        localStorage.setItem('connect4_user', JSON.stringify(newUser));
        onSignIn(newUser);
      } else {
        // Sign in existing user
        const { data: existingUser, error: queryError } = await supabase
          .from('players')
          .select('*')
          .eq('username', username)
          .eq('password', password) // In a real app, you would verify the hashed password
          .single();

        if (queryError || !existingUser) {
          throw new Error('Invalid username or password');
        }

        localStorage.setItem('connect4_user', JSON.stringify(existingUser));
        onSignIn(existingUser);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Connect 4 Coach
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isNewUser ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {isNewUser && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-indigo-400"
            >
              {loading ? 'Processing...' : (isNewUser ? 'Create Account' : 'Sign In')}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsNewUser(!isNewUser);
                setError(null);
              }}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {isNewUser ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth; 