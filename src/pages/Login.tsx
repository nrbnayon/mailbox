// src\pages\Login.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const Login = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (isAuthenticated && !isLoading) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className='min-h-screen bg-background flex items-center justify-center'>
      {isLoading ? (
        <div className='flex flex-col items-center'>
          <Loader2 className='h-8 w-8 animate-spin mb-4' />
          <p className='text-muted-foreground'>Checking login status...</p>
        </div>
      ) : (
        <div className='w-full max-w-md space-y-8 p-8'>
          <div className='text-center'>
            <h1 className='text-4xl font-bold'>AI Email Assistant</h1>
            <p className='mt-2 text-muted-foreground'>
              Sign in to manage your emails with AI
            </p>
          </div>

          <div className='space-y-4'>
            <button
              className='w-full flex items-center justify-center px-4 py-3 rounded-md border bg-white text-black hover:bg-gray-50 shadow-sm'
              onClick={() => login("google")}
            >
              <svg className='w-5 h-5 mr-2' viewBox='0 0 24 24'>
                <path
                  d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                  fill='#4285F4'
                />
                <path
                  d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                  fill='#34A853'
                />
                <path
                  d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                  fill='#FBBC05'
                />
                <path
                  d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                  fill='#EA4335'
                />
                <path d='M1 1h22v22H1z' fill='none' />
              </svg>
              Sign in with Gmail
            </button>

            <button
              className='w-full flex items-center justify-center px-4 py-3 rounded-md border bg-[#2F2F2F] text-white hover:bg-[#1E1E1E] shadow-sm'
              onClick={() => login("microsoft")}
            >
              <svg className='w-5 h-5 mr-2' viewBox='0 0 24 24' fill='#00A4EF'>
                <path d='M11.4 24H0V12.6h11.4V24z' />
                <path d='M24 24H12.6V12.6H24V24z' fill='#FFB900' />
                <path d='M11.4 11.4H0V0h11.4v11.4z' fill='#F25022' />
                <path d='M24 11.4H12.6V0H24v11.4z' fill='#7FBA00' />
              </svg>
              Sign in with Outlook
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
