// app/widget/page.tsx
import SupportWidget from '@/components/SupportWidget';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LoraBiz Support',
  other: {
    'theme-color': '#080E21',
  },
};

export default function WidgetPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `
        try {
          var params = new URLSearchParams(window.location.search);
          var t = params.get('theme');
          if (!t) {
            t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'dark';
          }
          if (t === 'dark') {
            document.documentElement.classList.add('dark');
          } else if (t === 'light') {
            document.documentElement.classList.remove('dark');
          }
        } catch (e) {}
      `}} />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body, #__next, main { 
          background-color: transparent !important; 
          background: transparent !important; 
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          color-scheme: inherit !important;
          overflow: hidden !important;
        }
      `}} />
      <main className="w-full h-full bg-transparent overflow-hidden">
        <SupportWidget />
      </main>
    </>
  );
}
