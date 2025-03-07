// src\contexts\AuthContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import axios from "@/lib/axios";
import { toast } from "react-hot-toast";

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (provider: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const { data } = await axios.get("/api/auth/me");
        setUser(data.user);
        setIsAuthenticated(true);
      } catch (error) {
        // Only show error message if it's not a 401 (unauthorized)
        if ((error as any)?.response?.status !== 401) {
          toast.error("Failed to verify authentication status");
        }
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Check URL for auth callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const error = urlParams.get("error");

    if (token) {
      // Save token to localStorage or cookies
      localStorage.setItem("auth_token", token);
      // Remove token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Trigger auth check
      checkAuthWithToken(token);
    }

    if (error) {
      toast.error(`Authentication failed: ${error}`);
      // Remove error from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkAuthWithToken = async (token: string) => {
    try {
      setIsLoading(true);
      const { data } = await axios.get("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUser(data.user);
      setIsAuthenticated(true);
      toast.success("Successfully logged in!");
    } catch (error) {
      toast.error("Login failed. Please try again.");
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("auth_token");
    } finally {
      setIsLoading(false);
    }
  };

  const login = (provider: string) => {
    // Show loading toast
    toast.loading("Redirecting to login...", {
      id: "login-redirect",
    });

    // Redirect to auth endpoint
    window.location.href = `${
      import.meta.env.VITE_API_URL
    }/api/auth/${provider}?redirect_url=${encodeURIComponent(
      window.location.origin
    )}`;
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await axios.post("/api/auth/logout");
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("auth_token");
      toast.success("Successfully logged out");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Logout failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
