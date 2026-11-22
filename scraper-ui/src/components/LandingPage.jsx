import React from 'react';
import { Sun, Moon, Terminal, Sparkles, Globe, Download, Database, Zap, Shield, ArrowRight } from 'lucide-react';

export default function LandingPage({ onGetStarted, onLogin, theme, toggleTheme }) {
  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-800 font-sans text-slate-700 dark:text-slate-300 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] hidden dark:block bg-purple-500/10 rounded-full blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] hidden dark:block bg-blue-500/10 rounded-full blur-[100px] -z-10 animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* Navigation */}
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
                onClick={onLogin}
                className="text-slate-800 px-5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-700 dark:hover:bg-slate-300 font-semibold transition-colors cursor-pointer"
              >
                Login
              </button>
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

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-sm font-semibold mb-8 shadow-sm dark:shadow-none">
          <Sparkles className="w-4 h-4" />
          <span>The Next Generation of Web Scraping</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tight max-w-4xl mb-8 leading-tight">
          Extract Data from Any Website, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Instantly.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mb-12 leading-relaxed">
          The universal web scraping engine built for scale. Discover URLs, extract structured data, and download your results in Excel or CSV with just a few clicks.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <button 
            onClick={onGetStarted}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl shadow-purple-500/20 flex items-center justify-center gap-2 group cursor-pointer"
          >
            Start Scraping for Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full text-left">
          <FeatureCard 
            icon={<Globe className="w-6 h-6 text-blue-400" />}
            title="Universal Discovery"
            description="Automatically map out and discover every URL on a target domain with our intelligent spider engine."
          />
          <FeatureCard 
            icon={<Database className="w-6 h-6 text-purple-400" />}
            title="Structured Extraction"
            description="Target specific pages or crawl an entire site to extract clean, structured data ready for analysis."
          />
          <FeatureCard 
            icon={<Download className="w-6 h-6 text-emerald-400" />}
            title="Excel & CSV Exports"
            description="Download your scraped data instantly in standard formats, or get a complete ZIP archive of the run."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white/70 dark:bg-slate-700/30 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 p-6 rounded-2xl hover:bg-white dark:hover:bg-slate-700/70 shadow-sm transition-colors">
      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
