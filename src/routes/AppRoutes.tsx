import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "../constants";
import { useAuth } from "../contexts";
import { ProtectedRoute } from "../components";

// Lazy load all pages
const LoginPage = lazy(() => import("../pages/Auth/LoginPage"));

// Admin pages
const AdminDashboard = lazy(() => import("../pages/Admin/Dashboard"));
const AdminUserManagement = lazy(() => import("../pages/Admin/UserManagement"));
const AdminDepartmentManagement = lazy(() => import("../pages/Admin/DepartmentManagement"));
const AdminBackupRestore = lazy(() => import("../pages/Admin/BackupRestore"));

// SQA Staff pages
const SQAStaffDashboard = lazy(() => import("../pages/SQAStaff/Dashboard"));
const SQAStaffAuditPlanning = lazy(() => import("../pages/SQAStaff/AuditPlanning"));
const SQAStaffFindingManagement = lazy(() => import("../pages/SQAStaff/FindingManagement"));
const SQAStaffReports = lazy(() => import("../pages/SQAStaff/Reports"));
const SQAStaffRequests = lazy(() => import("../pages/SQAStaff/Requests"));

// SQA Head pages
const SQAHeadDashboard = lazy(() => import("../pages/SQAHead/Dashboard"));
const SQAHeadAuditReview = lazy(() => import("../pages/SQAHead/AuditReview"));

// Department Staff (placeholder - using Dashboard for now)
const DepartmentStaffWelcome = lazy(() => import("../pages/DepartmentStaff/Welcome"));

// Department Head (placeholder - using Dashboard for now)
const DepartmentHeadWelcome = lazy(() => import("../pages/DepartmentHead/Welcome"));

// Director (placeholder - using Dashboard for now)
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

            {/* Protected routes - Admin */}
            <Route
                path={ROUTES.ADMIN}
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/users"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminUserManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/departments"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminDepartmentManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/backup"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminBackupRestore />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes - SQA Staff */}
            <Route
                path={ROUTES.SQA_STAFF}
                element={
                    <ProtectedRoute allowedRoles={["SQAStaff"]}>
                        <SQAStaffDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/sqa-staff/planning"
                element={
                    <ProtectedRoute allowedRoles={["SQAStaff"]}>
                        <SQAStaffAuditPlanning />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/sqa-staff/findings"
                element={
                    <ProtectedRoute allowedRoles={["SQAStaff"]}>
                        <SQAStaffFindingManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/sqa-staff/reports"
                element={
                    <ProtectedRoute allowedRoles={["SQAStaff"]}>
                        <SQAStaffReports />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/sqa-staff/requests"
                element={
                    <ProtectedRoute allowedRoles={["SQAStaff"]}>
                        <SQAStaffRequests />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes - SQA Head */}
            <Route
                path={ROUTES.SQA_HEAD}
                element={
                    <ProtectedRoute allowedRoles={["SQAHead"]}>
                        <SQAHeadDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/sqa-head/audit-review"
                element={
                    <ProtectedRoute allowedRoles={["SQAHead"]}>
                        <SQAHeadAuditReview />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes - Department Staff (placeholder) */}
            <Route
                path={ROUTES.DEPARTMENT_STAFF}
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffWelcome />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes - Department Head (placeholder) */}
            <Route
                path={ROUTES.DEPARTMENT_HEAD}
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadWelcome />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes - Director (placeholder) */}
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
