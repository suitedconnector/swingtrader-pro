import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { UserProfile } from '@/components/UserProfile';
import { useSettingsDrawer } from '@/hooks/use-settings-drawer';

/** Right-side settings overlay; the current page stays in place underneath. */
export function SettingsDrawer() {
  const { isOpen, close } = useSettingsDrawer();

  return (
    <Sheet open={isOpen} onOpenChange={(next) => { if (!next) close(); }}>
      <SheetContent
        side="right"
        overlayClassName="bg-black/40"
        className="flex w-full flex-col gap-0 overflow-y-auto border-l border-border bg-popover p-0 shadow-none sm:max-w-md"
      >
        <SheetHeader className="space-y-1 px-6 pb-2 pt-6 text-left">
          <SheetTitle className="text-base font-semibold tracking-tight">Settings</SheetTitle>
          <SheetDescription className="text-sm">
            Account, email, bankroll and alert preferences.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-8">{isOpen && <UserProfile />}</div>
      </SheetContent>
    </Sheet>
  );
}
