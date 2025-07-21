/**
 * LoginButton.jsx
 *
 * Login/logout button component for the header.
 * Shows login button when not authenticated, user info and logout when authenticated.
 */
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import LoginForm from "./LoginForm";

const LoginButton = () => {
  const [showLoginForm, setShowLoginForm] = useState(false);
  const { user, logout, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="login-button loading">Loading...</div>;
  }

  if (isAuthenticated) {
    return (
      <div className="user-info">
        <span className="user-email">{user.email}</span>
        {user.is_admin && <span className="admin-badge">Admin</span>}
        <button onClick={logout} className="logout-button">
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setShowLoginForm(true)} className="login-button">
        Login
      </button>
      {showLoginForm && <LoginForm onClose={() => setShowLoginForm(false)} />}
    </>
  );
};

export default LoginButton;
