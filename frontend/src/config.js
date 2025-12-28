/**
 * Centralized API Configuration
 * Automatically detects environment and selects the appropriate Backend URL.
 * 
 * Logic:
 * 1. If VITE_API_URL is set in .env, use it.
 * 2. If running on localhost (dev), use localhost backend.
 * 3. Otherwise, use production backend.
 */

const getBaseUrl = () => {
    // If explicitly set in environment (e.g. via .env file), prioritize it.
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // Check if running locally
    if (
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
        // Local Backend URL
        return 'http://localhost:8080';
    }

    // Production Backend URL
    return 'https://backend-plexus-cicd.onrender.com';
};

export const API_URL = getBaseUrl();
