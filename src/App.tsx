import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { RadixRouteCleanup } from "@/components/RadixRouteCleanup";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import FrontendLayout from "@/components/FrontendLayout";
import AdminLayout from "@/components/AdminLayout";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import DashboardOverview from "@/pages/DashboardOverview";
import AdminRoles from "@/pages/AdminRoles";
import AdminAccounts from "@/pages/AdminAccounts";
import FreelancingAccounts from "@/pages/FreelancingAccounts";
import Projects from "@/pages/Projects";
import AdminProjects from "@/pages/AdminProjects";
import AdminTaskPool from "@/pages/AdminTaskPool";
import TaskPool from "@/pages/TaskPool";
import AdminPersonnel from "@/pages/AdminPersonnel";
import Personnel from "@/pages/Personnel";
import AdminClients from "@/pages/AdminClients";
import Clients from "@/pages/Clients";
import AdminUsefulLinks from "@/pages/AdminUsefulLinks";
import UsefulLinks from "@/pages/UsefulLinks";
import AdminPayments from "@/pages/AdminPayments";
import Payments from "@/pages/Payments";
import NotFound from "./pages/NotFound";
import OAuthGoogleDriveCallback from "@/pages/OAuthGoogleDriveCallback";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <RadixRouteCleanup />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/oauth/google-drive/callback"
              element={
                <ProtectedRoute requiredRole="admin">
                  <OAuthGoogleDriveCallback />
                </ProtectedRoute>
              }
            />

            {/* Frontend — logged-in user read-only views */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <FrontendLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardOverview />} />
              <Route path="projects" element={<Projects />} />
              <Route path="clients" element={<Clients />} />
              <Route path="accounts" element={<FreelancingAccounts />} />
              <Route path="payments" element={<Payments />} />
              <Route path="tasks" element={<TaskPool />} />
              <Route path="personnel" element={<Personnel />} />
              <Route path="useful-links" element={<UsefulLinks />} />
            </Route>

            {/* Admin — full CRUD, separate layout */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/tasks" replace />} />
              <Route path="roles" element={<AdminRoles />} />
              <Route path="accounts" element={<AdminAccounts />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="tasks" element={<AdminTaskPool />} />
              <Route path="personnel" element={<AdminPersonnel />} />
              <Route path="useful-links" element={<AdminUsefulLinks />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
