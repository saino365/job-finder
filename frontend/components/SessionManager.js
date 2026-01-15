"use client";
import { useEffect } from 'react';

/**
 * D109: Session Management - Handle browser close without logout
 * This component manages session cleanup when the browser is closed
 */
export default function SessionManager() {
  useEffect(() => {
    // Handle browser close/tab close
    const handleBeforeUnload = (e) => {
      // Note: Modern browsers restrict what we can do in beforeunload
      // We can't make async calls, but we can clear sensitive data
      // The token will remain in localStorage for security (it's needed for auto-login)
      // But we can set a flag to indicate the session ended
      try {
        sessionStorage.setItem('session_ended', Date.now().toString());
      } catch (err) {
        // Ignore errors in beforeunload
      }
    };

    // Handle visibility change (tab switch, minimize, etc.)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab is hidden - could be minimized or switched away
        try {
          sessionStorage.setItem('last_activity', Date.now().toString());
        } catch (err) {
          // Ignore errors
        }
      } else if (document.visibilityState === 'visible') {
        // Tab is visible again - check if session is still valid
        try {
          const token = localStorage.getItem('jf_token');
          if (token) {
            // Token exists, verify it's still valid by checking expiry
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const expiry = payload.exp * 1000; // Convert to milliseconds
              const now = Date.now();
              
              // If token is expired, clear it
              if (expiry < now) {
                localStorage.removeItem('jf_token');
                // Redirect to login if on a protected page
                if (window.location.pathname !== '/login' && 
                    window.location.pathname !== '/register' && 
                    window.location.pathname !== '/register-company') {
                  window.location.href = '/login?expired=true';
                }
              }
            } catch (err) {
              // Invalid token format, clear it
              localStorage.removeItem('jf_token');
            }
          }
        } catch (err) {
          // Ignore errors
        }
      }
    };

    // Handle page unload (browser close, navigation away)
    const handleUnload = () => {
      // Set session end marker
      try {
        sessionStorage.setItem('session_ended', Date.now().toString());
      } catch (err) {
        // Ignore errors
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('unload', handleUnload);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  // This component doesn't render anything
  return null;
}
