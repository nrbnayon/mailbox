// src\routes\index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import EmailView from "@/pages/EmailView";
import Chat from "@/pages/Chat";
import { Loader2 } from "lucide-react";

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className='h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center'>
          <Loader2 className='h-12 w-12 animate-spin mb-4' />
          <p className='text-lg'>Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to='/login' />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path='/login' element={<Login />} />
      <Route
        path='/'
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path='email/:id' element={<EmailView />} />
        <Route path='chat' element={<Chat />} />
        <Route
          path='settings'
          element={
            <div className='p-4'>
              <h1 className='text-2xl font-bold'>Settings</h1>
            </div>
          }
        />
      </Route>
      <Route path='*' element={<Navigate to='/' />} />
    </Routes>
  );
};

export default AppRoutes;
