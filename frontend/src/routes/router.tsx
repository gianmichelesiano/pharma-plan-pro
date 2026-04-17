import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "../components/AppShell";
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

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/",
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "employees", element: <EmployeesPage /> },
      { path: "availability", element: <AvailabilityPage /> },
      { path: "absences", element: <AbsencesPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "schedule", element: <SchedulePage /> },
      { path: "training", element: <TrainingPage /> },
      { path: "piano", element: <PianificazionePage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
