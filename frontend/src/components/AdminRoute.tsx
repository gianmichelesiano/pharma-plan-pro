import { Navigate, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";

type Props = { children?: ReactNode };

export function AdminRoute({ children }: Props) {
  const { loading, session, isAdmin } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return children ? <>{children}</> : <Outlet />;
}
