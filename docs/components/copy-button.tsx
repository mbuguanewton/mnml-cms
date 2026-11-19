'use client';

import { useState } from 'react';

/** Copies the code of the code block it sits in. */
export function CopyButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="docs-code-copy"
      aria-label={copied ? 'Copied' : 'Copy code'}
      title={copied ? 'Copied' : 'Copy code'}
      onClick={async (e) => {
        const code = e.currentTarget.closest('.docs-code')?.querySelector('pre')?.innerText ?? '';
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M4 16V5a2 2 0 0 1 2-2h11" />
        </svg>
      )}
    </button>
  );
}
