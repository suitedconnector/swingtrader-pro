import { PageHeader } from '@/components/layout/primitives';
import { Sidebar as OverviewWidgets } from '@/components/Sidebar';

// Interim Overview: reuses the former dashboard side-column widgets until the
// dedicated Overview page is built (redesign step 4).
export default function Overview() {
  return (
    <>
      <PageHeader title="Overview" description="Market status, watchlists, today's stats and alerts." />
      <div className="max-w-xl">
        <OverviewWidgets />
      </div>
    </>
  );
}
