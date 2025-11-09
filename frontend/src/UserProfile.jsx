import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import './UserProfile.css';

const UserProfile = () => {
    const { user, logout, login, isAuthenticated } = useAuth();
    const [showMenu, setShowMenu] = useState(false);

    const toggleMenu = () => {
        setShowMenu(!showMenu);
    };

    const handleLogout = () => {
        setShowMenu(false);
        logout();
    };

    if (!isAuthenticated) {
        return (
            <div className="user-profile-container">
                <button className="login-button" onClick={login}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                        <polyline points="10 17 15 12 10 7"></polyline>
                        <line x1="15" y1="12" x2="3" y2="12"></line>
                    </svg>
                    Sign In
                </button>
            </div>
        );
    }

    return (
        <div className="user-profile-container">
            <div className="user-profile" onClick={toggleMenu}>
                <img 
                    src={user?.image || '/default-avatar.png'} 
                    alt={user?.name || 'User'} 
                    className="user-avatar"
                    onError={(e) => {
                        e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user?.name || 'User') + '&background=667eea&color=fff';
                    }}
                />
                <div className="user-info">
                    <span className="user-name">{user?.name || 'User'}</span>
                    <span className="user-email">{user?.email || ''}</span>
                </div>
                <svg 
                    className={`dropdown-icon ${showMenu ? 'open' : ''}`}
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>

            {showMenu && (
                <>
                    <div className="menu-overlay" onClick={() => setShowMenu(false)}></div>
                    <div className="user-menu">
                        <div className="menu-header">
                            <img 
                                src={user?.image || '/default-avatar.png'} 
                                alt={user?.name || 'User'} 
                                className="menu-avatar"
                                onError={(e) => {
                                    e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user?.name || 'User') + '&background=667eea&color=fff';
                                }}
                            />
                            <div className="menu-user-info">
                                <span className="menu-user-name">{user?.name || 'User'}</span>
                                <span className="menu-user-email">{user?.email || ''}</span>
                            </div>
                        </div>
                        <div className="menu-divider"></div>
                        <button className="menu-item logout-item" onClick={handleLogout}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default UserProfile;

