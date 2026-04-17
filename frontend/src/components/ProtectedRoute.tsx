import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { ReactNode } from "react";

type Props = { children?: ReactNode };

export function ProtectedRoute({ children }: Props) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 24 }}>Loading session...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
