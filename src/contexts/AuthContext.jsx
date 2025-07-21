/**
 * AuthContext.jsx
 *
 * Provides authentication state management across the application.
 * Handles login, logout, registration, and token persistence.
 */
import { createContext, useContext, useState, useEffect } from "react";
import { API_ENDPOINTS } from "../constants";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Loading state prevents UI flicker during token verification on app startup
  // Without this, users would briefly see login UI before being authenticated
  const [loading, setLoading] = useState(true);

  // Check for existing token on app load
  // This is crucial for maintaining login state across browser sessions:
  // - Without this, users would be logged out on every page refresh
  // - We verify the token with the server to ensure it's still valid
  // - Invalid/expired tokens are automatically cleaned up
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      // Verify the stored token is still valid by calling the backend
      // This prevents users from staying "logged in" with expired tokens
      const response = await fetch(API_ENDPOINTS.AUTH.ME, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token is invalid/expired - clean it up from localStorage
        // This prevents accumulation of stale tokens
        localStorage.removeItem("auth_token");
      }
    } catch (error) {
      console.error("Token verification failed:", error);
      // Network error or other issue - clean up the token to be safe
      localStorage.removeItem("auth_token");
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store the JWT token in localStorage for persistence across browser sessions
        // This allows users to stay logged in even after closing/reopening the browser
        localStorage.setItem("auth_token", data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, error: "Network error" };
    }
  };

  const register = async (email, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("auth_token", data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Registration failed:", error);
      return { success: false, error: "Network error" };
    }
  };

  const logout = () => {
    // Remove the token from localStorage to complete the logout process
    // This ensures the user won't be automatically logged back in on page refresh
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
