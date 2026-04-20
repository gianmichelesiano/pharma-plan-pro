import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { AdminRoute } from "../components/AdminRoute";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AbsencesPage } from "../pages/AbsencesPage";
import { AvailabilityPage } from "../pages/AvailabilityPage";
import { DashboardPage } from "../pages/DashboardPage";
import { EmployeesPage } from "../pages/EmployeesPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { RulesPage } from "../pages/RulesPage";
import { SchedulePage } from "../pages/SchedulePage";
import { TrainingPage } from "../pages/TrainingPage";
import { PianificazionePage } from "../pages/PianificazionePage";
import { EmailTestPage } from "../pages/EmailTestPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { PendingApprovalPage } from "../pages/PendingApprovalPage";

export const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    { path: "/pending", element: <PendingApprovalPage /> },
    {
      path: "/",
      element: <ProtectedRoute><AppShell /></ProtectedRoute>,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: "schedule", element: <SchedulePage /> },
        { path: "piano", element: <PianificazionePage /> },
        {
          element: <AdminRoute />,
          children: [
            { path: "employees", element: <EmployeesPage /> },
            { path: "availability", element: <AvailabilityPage /> },
            { path: "absences", element: <AbsencesPage /> },
            { path: "rules", element: <RulesPage /> },
            { path: "training", element: <TrainingPage /> },
            { path: "email-test", element: <EmailTestPage /> },
          ],
        },
        { path: "admin/users", element: <AdminRoute><AdminUsersPage /></AdminRoute> },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);
