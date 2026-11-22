import React, { useState } from 'react';
import { loginUser, registerUser } from '../api/auth';
import { Loader2, Sparkles, Terminal, ArrowLeft, Sun, Moon } from 'lucide-react';

export default function AuthScreen({ onLoginSuccess, onBack, theme, toggleTheme, initialMode = 'login' }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let userData;
      if (isLogin) {
        userData = await loginUser(email, password, rememberMe);
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        userData = await registerUser(email, fullName, password, rememberMe);
      }
      onLoginSuccess(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white relative overflow-hidden">
      {/* Topbar */}
      <nav className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0 z-20 relative">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">Web Scraper</h1>
                <div className="relative">
                  <Terminal className="w-6 h-6 text-purple-500" />
                  <Sparkles className="w-3 h-3 text-blue-400 absolute -top-1 -right-1" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm dark:shadow-none"
                title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative bg-slate-200 dark:bg-slate-800">
        {/* Background blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] hidden dark:block bg-purple-500/10 rounded-full blur-[100px] -z-10 animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] hidden dark:block bg-blue-800 rounded-full blur-[100px] -z-10 animate-pulse" style={{ animationDelay: '2s' }}></div>

        {/* Back Button */}
        {onBack && (
          <button 
            onClick={onBack}
            className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-slate-700 bg-slate-300 hover:bg-slate-400/50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg px-3 py-2 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium transition-colors cursor-pointer z-10"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        )}

        <div className="w-full max-w-md">
        
        {/* Header section */}
        <div className="text-center mb-6 relative">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500 tracking-tight mb-3">
            Web Scraper
          </h1>
          <p className="text-slate-400 font-medium">Universal Web Scraping Engine</p>
        </div>

        {/* Card */}
        <div className="bg-white/50 dark:bg-slate-700/50 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500 opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 text-center">
            {isLogin ? 'Welcome' : 'Create Account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block p-3 transition-all placeholder-slate-500 outline-none"
                  placeholder="Enter your full name"
                  required
                  autoComplete="name"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block p-3 transition-all placeholder-slate-500 outline-none"
                placeholder="Enter your email address"
                required
                autoComplete="email"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block p-3 transition-all placeholder-slate-500 outline-none"
                placeholder="Enter your password"
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>
            
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block p-3 transition-all placeholder-slate-500 outline-none"
                  placeholder="Confirm your password"
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-purple-600 focus:ring-purple-600 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-500 cursor-pointer">
                Remember me
              </label>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email || !password || (!isLogin && (!fullName || !confirmPassword))}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold py-3 px-4 rounded-lg shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isLogin ? 'Signing In...' : 'Registering...'}</span>
                </>
              ) : (
                <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-purple-500 hover:text-purple-300 dark:text-purple-300 dark:hover:text-purple-400 font-medium transition-colors outline-none focus-visible:underline cursor-pointer"
            >
              {isLogin ? 'Create one' : 'Sign in'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
