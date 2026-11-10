import { ExternalLink } from 'lucide-react';
import { AccentBar, PageHeader, Section } from '@/components/layout/primitives';

interface LearnLink {
  title: string;
  description: string;
  href: string;
  source: string;
}

// Quizzes hosted elsewhere. Google does not allow NotebookLM pages inside
// other sites, so each opens in a new tab.
const QUIZZES: LearnLink[] = [
  {
    title: 'Breakout Strategy Quiz',
    description: 'Test what you know about trading breakouts.',
    href: 'https://notebooklm.link.google/bLcuyDC5R44e',
    source: 'NotebookLM',
  },
];

function LinkList({ items }: { items: LearnLink[] }) {
  return (
    <ul className="divide-y divide-border/60">
      {items.map((item) => (
        <li key={item.href}>
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 py-3 text-sm"
          >
            <AccentBar signal="info" orientation="vertical" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground group-hover:underline">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{item.description}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
              Open in {item.source}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function Learn() {
  return (
    <>
      <PageHeader title="Learn" description="Lessons, flashcards and quizzes on swing trading." />

      <div className="max-w-3xl">
        <Section title={`Quizzes · ${QUIZZES.length}`}>
          <LinkList items={QUIZZES} />
          <p className="pt-3 text-xs text-muted-foreground">
            Quizzes open in a new tab. NotebookLM may ask you to sign in with Google.
          </p>
        </Section>

        <Section title="Content and flashcards">
          <p className="text-sm text-muted-foreground">Coming soon.</p>
        </Section>
      </div>
    </>
  );
}
