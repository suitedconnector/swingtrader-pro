import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { DISCLAIMER_FULL, DISCLAIMER_SHORT } from '@shared/disclaimer';

/** Slim, always-visible notice shown at the top of every page. */
export function DisclaimerBar({ className }: { className?: string }) {
  return (
    <div
      role="note"
      aria-label="Disclaimer"
      className={cn(
        'flex items-center justify-center gap-2 border-b border-signal-warn/30 bg-signal-warn/10 px-4 py-1.5 text-center text-xs text-foreground',
        className
      )}
    >
      <Info className="h-3.5 w-3.5 shrink-0 text-signal-warn" aria-hidden="true" />
      <span>
        <span className="font-medium">{DISCLAIMER_SHORT}</span>{' '}
        <span className="text-muted-foreground">Trading involves risk of loss.</span>
      </span>
    </div>
  );
}

/**
 * One-time notice every signed-in user must accept. It cannot be dismissed
 * any other way; acceptance is saved on the account.
 */
export function DisclaimerGate({ accepted }: { accepted: boolean }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const accept = async (e: React.MouseEvent) => {
    e.preventDefault(); // keep the dialog open until the server confirms
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest('POST', '/api/disclaimer/accept');
      // Only a JSON answer with a saved time counts as accepted.
      const data = await res.json().catch(() => null);
      if (!data?.disclaimerAcceptedAt) throw new Error('Acceptance was not saved');
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    } catch {
      setError('Could not save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={!accepted}>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Educational use only</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {DISCLAIMER_FULL.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-signal-down" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogAction onClick={accept} disabled={busy}>
            {busy ? 'Saving…' : 'I understand'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
