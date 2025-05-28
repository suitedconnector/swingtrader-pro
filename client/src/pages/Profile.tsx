import { UserProfile } from '@/components/UserProfile';

export default function Profile() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Profile</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your notification preferences and contact information
          </p>
        </div>
        
        <UserProfile />
      </div>
    </div>
  );
}