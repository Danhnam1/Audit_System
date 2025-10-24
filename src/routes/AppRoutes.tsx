import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "../constants";
import { useAuth } from "../contexts";
import { ProtectedRoute } from "../components";

// Lazy load all pages
const LoginPage = lazy(() => import("../pages/Auth/LoginPage"));
const AdminWelcome = lazy(() => import("../pages/Admin/Welcome"));
const SQAStaffWelcome = lazy(() => import("../pages/SQAStaff/Welcome"));
const SQAHeadWelcome = lazy(() => import("../pages/SQAHead/Welcome"));
const DepartmentStaffWelcome = lazy(() => import("../pages/DepartmentStaff/Welcome"));
const DepartmentHeadWelcome = lazy(() => import("../pages/DepartmentHead/Welcome"));
const DirectorWelcome = lazy(() => import("../pages/Director/Welcome"));


// AppRoutes component - chỉ chứa các route definitions
export function AppRoutes() {
    const { isAuthenticated, user } = useAuth();

    // Redirect to appropriate dashboard based on role
    const getDefaultRoute = () => {
        if (!user) return ROUTES.LOGIN;

        const roleRouteMap: Record<string, string> = {
            Admin: ROUTES.ADMIN,
            SQAStaff: ROUTES.SQA_STAFF,
            SQAHead: ROUTES.SQA_HEAD,
            DepartmentStaff: ROUTES.DEPARTMENT_STAFF,
            DepartmentHead: ROUTES.DEPARTMENT_HEAD,
            Director: ROUTES.DIRECTOR,
        };

        // Debug log để xem user role
        console.log('Current user:', user);
        console.log('Redirecting to:', roleRouteMap[user.role] || ROUTES.LOGIN);

        return roleRouteMap[user.role] || ROUTES.LOGIN;
    };

    return (
        <Routes>
            {/* Public route - Login */}
            <Route
                path={ROUTES.LOGIN}
                element={
                    isAuthenticated ? (
                        <Navigate to={getDefaultRoute()} replace />
                    ) : (
                        <LoginPage />
                    )
                }
            />

            {/* Protected routes - Each role can only access their own dashboard */}
            <Route
                path={ROUTES.ADMIN}
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminWelcome />
                    </ProtectedRoute>
                }
            />
            <Route
                path={ROUTES.SQA_STAFF}
                element={
                    <ProtectedRoute allowedRoles={["SQAStaff"]}>
                        <SQAStaffWelcome />
                    </ProtectedRoute>
                }
            />
            <Route
                path={ROUTES.SQA_HEAD}
                element={
                    <ProtectedRoute allowedRoles={["SQAHead"]}>
                        <SQAHeadWelcome />
                    </ProtectedRoute>
                }
            />
            <Route
                path={ROUTES.DEPARTMENT_STAFF}
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffWelcome />
                    </ProtectedRoute>
                }
            />
            <Route
                path={ROUTES.DEPARTMENT_HEAD}
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadWelcome />
                    </ProtectedRoute>
                }
            />
            <Route
                path={ROUTES.DIRECTOR}
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorWelcome />
                    </ProtectedRoute>
                }
            />

            {/* Root route - redirect to login or user's dashboard */}
            <Route
                path={ROUTES.HOME}
                element={<Navigate to={getDefaultRoute()} replace />}
            />

            {/* Catch all - redirect to login or user's dashboard */}
            <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
        </Routes>
    );
}
