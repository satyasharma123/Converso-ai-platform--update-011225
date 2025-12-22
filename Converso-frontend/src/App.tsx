import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import EmailInbox from "./pages/EmailInbox";
import LinkedInInbox from "./pages/LinkedInInbox";
import Team from "./pages/Team";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import SalesPipeline from "./pages/SalesPipeline";
import WorkQueue from "./pages/WorkQueue";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inbox/email">
              <Route index element={<ProtectedRoute><EmailInbox /></ProtectedRoute>} />
              <Route path=":folder" element={<ProtectedRoute><EmailInbox /></ProtectedRoute>} />
              <Route path=":folder/:conversationId" element={<ProtectedRoute><EmailInbox /></ProtectedRoute>} />
            </Route>
            <Route path="/inbox/linkedin">
              <Route index element={<ProtectedRoute><LinkedInInbox /></ProtectedRoute>} />
              <Route path=":conversationId" element={<ProtectedRoute><LinkedInInbox /></ProtectedRoute>} />
            </Route>
            <Route path="/work-queue" element={<ProtectedRoute><WorkQueue /></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute><SalesPipeline /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute requiredRole="admin"><Team /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
