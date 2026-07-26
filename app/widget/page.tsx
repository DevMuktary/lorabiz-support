// app/widget/page.tsx
"use client";

import { useEffect } from 'react';
import SupportWidget from '@/components/SupportWidget';

export default function WidgetPage() {
  // CRITICAL: Next.js injects a white background via globals.css or the root layout.
  // This forcefully strips it from the DOM so the iframe is completely see-through.
  useEffect(() => {
    document.documentElement.style.setProperty('background', 'transparent', 'important');
    document.documentElement.style.setProperty('background-color', 'transparent', 'important');
    document.body.style.setProperty('background', 'transparent', 'important');
    document.body.style.setProperty('background-color', 'transparent', 'important');
  }, []);

  return (
    <main className="w-full h-full bg-transparent overflow-hidden">
      <SupportWidget />
    </main>
  );
}
