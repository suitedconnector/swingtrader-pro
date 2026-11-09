import { UserProfile } from '@/components/UserProfile';
import { PageHeader } from '@/components/layout/primitives';

// Rendered inside the app shell. Becomes a settings drawer in redesign step 3.
export default function Profile() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        description="Account, contact email, bankroll and notification preferences."
      />
      <UserProfile />
    </div>
  );
}
