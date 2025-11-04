import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';

const AuditPlanDetail = () => {
	const { user } = useAuth();
	const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

	return (
		<MainLayout user={layoutUser}>
			<div className="px-6 py-6">
				<div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
					<h1 className="text-2xl font-semibold text-primary-600">Audit Plan Detail</h1>
					<p className="text-gray-600 mt-2">Review audit plan information and confirm details.</p>
					<div className="mt-4 text-sm text-gray-500">
						This is a placeholder detail view. Wire up your route params and data as needed.
					</div>
				</div>
			</div>
		</MainLayout>
	);
};

export default AuditPlanDetail;

