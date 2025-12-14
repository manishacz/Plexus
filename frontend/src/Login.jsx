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
            <div className="login-logo-header">
               <span className="logo-text">Plexus</span>
            </div>
            
            <div className="login-content">
                <h1 className="login-title">Log in or sign up</h1>
                <p className="login-subtitle">You'll get smarter responses and can upload files, images, and more.</p>

                <div className="social-buttons">
                    <button className="social-btn" onClick={handleGoogleLogin}>
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="social-icon" />
                        <span>Continue with Google</span>
                    </button>
                    
                    <button className="social-btn" onClick={() => alert("Apple login coming soon!")}>
                        <img src="https://www.svgrepo.com/show/445136/apple.svg" alt="Apple" className="social-icon" />
                        <span>Continue with Apple</span>
                    </button>
                    
                    <button className="social-btn" onClick={() => alert("Microsoft login coming soon!")}>
                        <img src="https://www.svgrepo.com/show/452263/microsoft.svg" alt="Microsoft" className="social-icon" />
                        <span>Continue with Microsoft</span>
                    </button>
                    
                    <button className="social-btn" onClick={() => alert("Phone login coming soon!")}>
                        <svg className="social-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        <span>Continue with phone</span>
                    </button>
                </div>

                <div className="divider">
                    <span>OR</span>
                </div>

                <div className="email-login">
                    <input type="email" placeholder="Email address" className="email-input" />
                    <button className="continue-btn">Continue</button>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}
            </div>

            <div className="login-footer">
                <a href="#">Terms of Use</a>
                <span className="separator">|</span>
                <a href="#">Privacy Policy</a>
            </div>
        </div>
    );
};

export default Login;

