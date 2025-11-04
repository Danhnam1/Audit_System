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

// Department Staff pages
const DepartmentStaffDashboard = lazy(() => import("../pages/DepartmentStaff/Dashboard"));
const DepartmentStaffAssignedTasks = lazy(() => import("../pages/DepartmentStaff/AssignedTasks"));
const DepartmentStaffTaskDetail = lazy(() => import("../pages/DepartmentStaff/TaskDetail"));
const DepartmentStaffUploadEvidence = lazy(() => import("../pages/DepartmentStaff/UploadEvidence"));
const DepartmentStaffTodoList = lazy(() => import("../pages/DepartmentStaff/TodoList"));
const DepartmentStaffFindingsProgress = lazy(() => import("../pages/DepartmentStaff/FindingsProgress"));
const DepartmentStaffCheckDeadlines = lazy(() => import("../pages/DepartmentStaff/CheckDeadlines"));

// Department Head pages
const DepartmentHeadWelcome = lazy(() => import("../pages/DepartmentHead/Welcome"));
const DepartmentHeadAuditPlans = lazy(() => import("../pages/DepartmentHead/auditplan/AuditPlans"));
const DepartmentHeadAuditPlanDetail = lazy(() => import("../pages/DepartmentHead/auditplan/AuditPlanDetail"));
const DepartmentHeadAuditPlanConfirm = lazy(() => import("../pages/DepartmentHead/auditplan/AuditPlanConfirm"));
const DepartmentHeadAssignTasks = lazy(() => import("../pages/DepartmentHead/taskasign/AssignTasks"));
const DepartmentHeadFindingsList = lazy(() => import("../pages/DepartmentHead/findings/FindingsList"));
const DepartmentHeadAssignStaff = lazy(() => import("../pages/DepartmentHead/taskasign/AssignStaff"));
const DepartmentHeadReviewEvidence = lazy(() => import("../pages/DepartmentHead/ReviewEvidence"));
const DepartmentHeadEvidenceDetail = lazy(() => import("../pages/DepartmentHead/EvidenceDetail"));
const DepartmentHeadFindingsProgress = lazy(() => import("../pages/DepartmentHead/findings/FindingsProgress"));

// Director pages
const DirectorDashboard = lazy(() => import("../pages/Director/Dashboard"));
const DirectorReviewAuditPlans = lazy(() => import("../pages/Director/ReviewAuditPlans"));
const DirectorAuditPlanDetail = lazy(() => import("../pages/Director/AuditPlanDetail"));
const DirectorReviewAuditResults = lazy(() => import("../pages/Director/ReviewAuditResults"));
const DirectorSummaryReport = lazy(() => import("../pages/Director/SummaryReport"));


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

            {/* Protected routes - Department Staff */}
            <Route
                path={ROUTES.DEPARTMENT_STAFF}
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-staff/tasks"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffAssignedTasks />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-staff/tasks/:taskId"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffTaskDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-staff/upload-evidence"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffUploadEvidence />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-staff/upload-evidence/:taskId"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffUploadEvidence />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-staff/todo"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffTodoList />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-staff/progress"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffFindingsProgress />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-staff/deadlines"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentStaff"]}>
                        <DepartmentStaffCheckDeadlines />
                    </ProtectedRoute>
                }
            />
        

            {/* Protected routes - Department Head */}
            <Route
                path={ROUTES.DEPARTMENT_HEAD}
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadWelcome />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-head/audit-plans"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadAuditPlans />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-head/audit-plans/:id/detail"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadAuditPlanDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-head/audit-plans/:id/confirm"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadAuditPlanConfirm />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-head/assign-tasks"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadAssignTasks />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-head/assign-tasks/findings"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadFindingsList />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-head/assign-tasks/:id/assign"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadAssignStaff />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-head/review-evidence"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadReviewEvidence />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-head/review-evidence/:id"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadEvidenceDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/department-head/findings"
                element={
                    <ProtectedRoute allowedRoles={["DepartmentHead"]}>
                        <DepartmentHeadFindingsProgress />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes - Director */}
            <Route
                path={ROUTES.DIRECTOR}
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/review-plans"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorReviewAuditPlans />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/review-plans/:planId"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorAuditPlanDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/review-results"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorReviewAuditResults />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/summary-report"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorSummaryReport />
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
