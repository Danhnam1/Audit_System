import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';

const AuditPlans = () => {
	const { user } = useAuth();
	const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

	return (
		<MainLayout user={layoutUser}>
			<div className="px-6 py-6">
				<div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
					<h1 className="text-2xl font-semibold text-primary-600">Audit Plans</h1>
					<p className="text-gray-600 mt-2">List and manage audit plans assigned to your department.</p>
					<div className="mt-4 text-sm text-gray-500">
						This is a placeholder page. Implement your real data and actions here.
					</div>
				</div>
			</div>
		</MainLayout>
	);
};

export default AuditPlans;

