import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { DashboardPage } from "../pages/DashboardPage";
import { EmployeesPage } from "../features/employees/EmployeesPage";
import { AbsencesPage } from "../features/absences/AbsencesPage";
import { ShiftsPage } from "../features/shifts/ShiftsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "employees", element: <EmployeesPage /> },
          { path: "shifts", element: <ShiftsPage /> },
          { path: "absences", element: <AbsencesPage /> },
        ],
      },
    ],
  },
]);
