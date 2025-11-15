import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-plexus-cicd.onrender.com';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user is authenticated on mount
    // useEffect(() => {
    //     checkAuthStatus();
    // }, []);
    // Check if user is authenticated on mount and handle OAuth redirect query
    useEffect(() => {
        (async () => {
            const params = new URLSearchParams(window.location.search);
            const authParam = params.get('auth');

            if (authParam === 'success') {
                // OAuth redirect returned with ?auth=success
                const ok = await checkAuthStatus();
                // remove query param without reloading
                window.history.replaceState({}, '', window.location.pathname);
                if (ok) {
                    // navigate to home after successful login
                    window.location.href = '/chat';
                }
            } else {
                await checkAuthStatus();
            }
        })();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const response = await fetch(`${API_URL}/api/auth/user`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                return true;
            } else {
                setUser(null);
                return false;
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            setUser(null);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const login = () => {
        // Redirect to Google OAuth
        window.location.href = `${API_URL}/api/auth/google`;
    };

    const logout = async () => {
        try {
            const response = await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                setUser(null);
                // Optionally redirect to login page
                window.location.href = '/';
            } else {
                throw new Error('Logout failed');
            }
        } catch (err) {
            console.error('Logout error:', err);
            setError('Failed to logout. Please try again.');
        }
    };

    const value = {
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!user,
        checkAuthStatus
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;

