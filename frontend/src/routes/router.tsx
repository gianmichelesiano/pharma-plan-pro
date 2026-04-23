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
import { CoverageRequestsPage } from "../pages/CoverageRequestsPage";
import { CoverageRespondPage } from "../pages/CoverageRespondPage";
import { PlanningPrintPage } from "../pages/PlanningPrintPage";

export const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    { path: "/pending", element: <PendingApprovalPage /> },
    { path: "/coverage/respond", element: <CoverageRespondPage /> },
    { path: "/piano/print", element: <ProtectedRoute><PlanningPrintPage /></ProtectedRoute> },
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
            { path: "coverage-requests", element: <CoverageRequestsPage /> },
          ],
        },
        { path: "admin/users", element: <AdminRoute><AdminUsersPage /></AdminRoute> },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
);
