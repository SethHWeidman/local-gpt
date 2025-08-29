/**
 * AuthContext.jsx
 *
 * Provides authentication state management across the application.
 * Handles login, logout, registration, and token persistence.
 */
import { createContext, useContext, useState, useEffect } from "react";
import { API_ENDPOINTS } from "../constants";

// Create a Context for authentication state and actions.
// Components can use the `useAuth` hook to access these values/functions.
const AuthContext = createContext();

/**
 * Custom hook to access authentication context.
 * Throws an error if used outside of an AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/**
 * AuthProvider wraps the application and provides authentication state (current user,
 * loading status) and actions (login, logout, register) via React Context to any child
 * component.
 */
export const AuthProvider = ({ children }) => {
  // The authenticated user object, or null if not logged in.
  const [user, setUser] = useState(null);
  // Loading indicator to suppress UI until token is verified on startup.
  const [loading, setLoading] = useState(true);

  /**
   * On mount, check for an existing auth token in localStorage. If found, verify it
   * with the backend; otherwise, clear loading state.
   */
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * verifyToken: confirm token validity with backend and load user data. On invalid or
   * errored verification, remove stale token.
   */
  const verifyToken = async (token) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.ME, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem("auth_token");
      }
    } catch (error) {
      console.error("Token verification failed:", error);
      localStorage.removeItem("auth_token");
    } finally {
      setLoading(false);
    }
  };

  /**
   * login: authenticate user and persist token on success.
   * Returns { success, error? }.
   */
  const login = async (email, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("auth_token", data.token);
        setUser(data.user);
        // Fetch full user profile (including API keys) after login
        await fetchCurrentUser();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, error: "Network error" };
    }
  };

  /**
   * register: create a new user account and persist token on success.
   * Returns { success, error? }.
   */
  const register = async (email, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("auth_token", data.token);
        setUser(data.user);
        // Fetch full user profile (including API keys) after registration
        await fetchCurrentUser();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Registration failed:", error);
      return { success: false, error: "Network error" };
    }
  };

  /**
   * logout: remove authentication token and clear user state.
   */
  const logout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  /**
   * Fetch current user info (including updated API keys) from the backend.
   */
  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        setUser(null);
        return;
      }
      const response = await fetch(API_ENDPOINTS.AUTH.ME, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
        localStorage.removeItem("auth_token");
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      setUser(null);
      localStorage.removeItem("auth_token");
    }
  };

  // Exposed context value: current user, status and auth actions.
  const value = {
    user,
    loading,
    login,
    register,
    logout,
    fetchCurrentUser,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
