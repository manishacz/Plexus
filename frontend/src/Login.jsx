import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import './Login.css';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css'; // Import styles
import { PulseLoader } from 'react-spinners'; // Assuming you might have this or I should use simple text or CSS spinner. usage shows react-spinners in package.json

const Login = () => {
    const { login, isAuthenticated, checkAuthStatus } = useAuth();
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Auth Modes: 'initial', 'mobile', 'email_register', 'otp'
    const [view, setView] = useState('initial');
    
    // Form Data
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']); // Array for 6 digits
    
    // OTP Metadata
    const [timer, setTimer] = useState(0);
    const [canResend, setCanResend] = useState(false);
    const timerRef = useRef(null);

    // Refs for OTP input auto-focus
    const otpRefs = useRef([]);

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
                    window.location.href = '/';
                } else {
                    setError('Login succeeded but session could not be established. Please try again.');
                }
            })();
        }
    }, [isAuthenticated, checkAuthStatus]);

    // Timer Logic
    useEffect(() => {
        if (timer > 0) {
            timerRef.current = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setCanResend(true);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [timer]);

    const handleGoogleLogin = () => {
        setError(null);
        login(); // Triggers existing Google Auth flow
    };

    const startMobileFlow = () => {
        setError(null);
        setView('mobile');
    };

    const getApiUrl = () => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
        
        if (baseUrl.endsWith('/api')) {
            return baseUrl;
        }
        return `${baseUrl}/api`;
    };

    const handleSendOtp = async (providedEmail = null) => {
        if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
            setError('Invalid phone number format. Please enter a valid number with country code.');
            return;
        }
        
        // If getting email, validate it
        if (view === 'email_register' && !providedEmail) {
             setError('Email is required for new account registration.');
             return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const API_URL = getApiUrl();
            const res = await fetch(`${API_URL}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    phoneNumber,
                    email: providedEmail 
                })
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(data.message);
                setView('otp');
                setTimer(data.canResendAfter || 60);
                setCanResend(false);
                // Clear previous OTP input
                setOtp(['', '', '', '', '', '']);
            } else {
                if (data.code === 'EMAIL_REQUIRED') {
                    // Switch to email input view for new user
                    setView('email_register');
                    setError(data.message); // Inform user why they need to email
                } else {
                    setError(data.error || 'Failed to send OTP.');
                }
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otpCode = otp.join('');
        if (otpCode.length !== 6) {
            setError('Please enter the complete 6-digit OTP.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const API_URL = getApiUrl();
            const res = await fetch(`${API_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    phoneNumber,
                    otp: otpCode 
                })
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess('Phone verified! Redirecting to dashboard...');
                // Trigger global auth check or redirect
                // Assuming session cookie is set
                 const ok = await checkAuthStatus();
                 if (ok) {
                    window.location.href = '/';
                 } else {
                     setError('Verified but session invalid. Try refreshing.');
                 }
            } else {
                setError(data.error || 'Verification failed.');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // OTP Input Handlers
    const handleOtpChange = (element, index) => {
        if (isNaN(element.value)) return;

        const newOtp = [...otp];
        newOtp[index] = element.value;
        setOtp(newOtp);

        // Auto-focus next input
        if (element.value !== '' && index < 5) {
            otpRefs.current[index + 1].focus();
        }
        
        // Optional: Auto-submit on fill
        if (index === 5 && element.value !== '') {
            // handleVerifyOtp(); // Uncomment if auto-submit desired, user requested optional
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace') {
            if (otp[index] === '' && index > 0) {
                otpRefs.current[index - 1].focus();
            }
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Render Components
    const renderInitial = () => (
        <div className="login-content">
            <h1 className="login-title">Log in or sign up</h1>
            <p className="login-subtitle">You'll get smarter responses and can upload files, images, and more.</p>

            <div className="social-buttons">
                <button className="social-btn" onClick={handleGoogleLogin}>
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="social-icon" />
                    <span>Continue with Google</span>
                </button>

                <button className="social-btn" onClick={startMobileFlow}>
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
                <input type="email" placeholder="Email address" className="email-input" disabled />
                <button className="continue-btn" disabled onClick={() => {}}>Continue (Use Social/Phone)</button>
            </div>
        </div>
    );

    const renderMobileInput = () => (
        <div className="login-content">
            <div className="back-nav" onClick={() => setView('initial')}>
                <span>&larr; Back</span>
            </div>
            <h1 className="login-title">Enter your number</h1>
            <p className="login-subtitle">We'll send you a verification code.</p>

            <div className="input-group">
                <PhoneInput
                    international
                    defaultCountry="IN"
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                    className="phone-input-container"
                />
            </div>

            <button 
                className="continue-btn" 
                onClick={() => handleSendOtp()} 
                disabled={loading || !phoneNumber}
                style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
                {loading ? <><PulseLoader size={8} color="#ffffff" /> Sending...</> : 'Continue'}
            </button>
        </div>
    );

    const renderEmailInput = () => (
        <div className="login-content">
            <div className="back-nav" onClick={() => setView('mobile')}>
                 <span>&larr; Back</span>
            </div>
            <h1 className="login-title">Almost there!</h1>
            <p className="login-subtitle">It looks like you're new. Please enter your email to secure your account and receive your OTP.</p>

            <div className="input-group">
                <input 
                    type="email" 
                    placeholder="name@example.com" 
                    className="email-input full-width"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
            </div>

            <button 
                className="continue-btn" 
                onClick={() => handleSendOtp(email)} 
                disabled={loading || !email}
                style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
               {loading ? <><PulseLoader size={8} color="#ffffff" /> Sending Code...</> : 'Send Verification Code'}
            </button>
        </div>
    );

    const renderOtpVerify = () => (
        <div className="login-content">
            <div className="back-nav" onClick={() => setView('mobile')}>
                 <span>&larr; Change Number</span>
            </div>
            <h1 className="login-title">Enter 6-digit code</h1>
            <p className="login-subtitle">We sent a code to your email.</p>

            <div className="otp-container">
                {otp.map((data, index) => (
                    <input
                        className="otp-field"
                        type="text"
                        name="otp"
                        maxLength="1"
                        key={index}
                        value={data}
                        ref={(ref) => otpRefs.current[index] = ref}
                        onChange={(e) => handleOtpChange(e.target, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        disabled={loading}
                    />
                ))}
            </div>

            <div className="timer-text">
                {formatTime(timer)}
            </div>

            <div className="resend-container">
                 <button 
                    className="text-btn" 
                    onClick={() => handleSendOtp(email || null)} 
                    disabled={!canResend || loading}
                 >
                     {canResend ? "Resend OTP" : "Wait to resend"}
                 </button>
            </div>

            <button 
                className="continue-btn" 
                onClick={handleVerifyOtp} 
                disabled={loading}
                style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
                {loading ? <><PulseLoader size={8} color="#ffffff" /> Verifying...</> : 'Verify & Login'}
            </button>
        </div>
    );

    return (
        <div className="login-container">
            <div className="login-logo-header">
               <span className="logo-text">Plexus</span>
            </div>
            
            {view === 'initial' && renderInitial()}
            {view === 'mobile' && renderMobileInput()}
            {view === 'email_register' && renderEmailInput()}
            {view === 'otp' && renderOtpVerify()}

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}
            {success && (
                <div className="success-message" style={{ color: 'green', marginTop: '10px', textAlign: 'center' }}>
                    {success}
                </div>
            )}
            
            <div className="login-footer">
                <a href="#">Terms of Use</a>
                <span className="separator">|</span>
                <a href="#">Privacy Policy</a>
            </div>
        </div>
    );
};

export default Login;

