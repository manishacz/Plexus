import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import './Login.css';

const Login = () => {
    const { login, isAuthenticated , checkAuthStatus } = useAuth();
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check for error in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        
        if (errorParam) {
            const errorMessages = {
                'authentication_failed': 'Authentication failed. Please try again.',
                'server_error': 'Server error occurred. Please try again later.',
                'Email already registered with different account': 'This email is already registered with a different account.'
            };
            
            setError(errorMessages[errorParam] || decodeURIComponent(errorParam));
            
            // Clear error from URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check for success in URL params
        const authParam = urlParams.get('auth');
        if (authParam === 'success' && isAuthenticated) {
            (async () => {
                const ok = await checkAuthStatus();
                // remove the ?auth=success from URL
                window.history.replaceState({}, document.title, window.location.pathname);
                if (ok) {
                    // perform a full navigation so protected routes / global state update correctly
                    window.location.href = '/';
                } else {
                    // optional: show an error if session didn't establish
                    setError('Login succeeded but session could not be established. Please try again.');
                }
            })();
        }
    }, [isAuthenticated, checkAuthStatus]);

    const handleGoogleLogin = () => {
        setError(null);
        login();
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <img src="/blacklogo.png" alt="Plexus Logo" className="login-logo" />
                    <h1>Welcome to Plexus</h1>
                    <p>Sign in to continue your conversations</p>
                </div>

                {error && (
                    <div className="error-message">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                <button className="google-login-btn" onClick={handleGoogleLogin}>
                    <svg className="google-icon" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                </button>

                <div className="login-footer">
                    <p className="privacy-text">
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>
            </div>

            <div className="login-features">
                <div className="feature">
                    <div className="feature-icon">💬</div>
                    <h3>Smart Conversations</h3>
                    <p>Engage in intelligent conversations with AI</p>
                </div>
                <div className="feature">
                    <div className="feature-icon">🔒</div>
                    <h3>Secure & Private</h3>
                    <p>Your data is encrypted and secure</p>
                </div>
                <div className="feature">
                    <div className="feature-icon">📱</div>
                    <h3>Access Anywhere</h3>
                    <p>Continue conversations across devices</p>
                </div>
            </div>
        </div>
    );
};

export default Login;

