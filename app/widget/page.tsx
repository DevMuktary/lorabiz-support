// app/widget/page.tsx
import SupportWidget from '@/components/SupportWidget';

export default function WidgetPage() {
  return (
    <>
      {/* 
        CRITICAL: This block completely overrides the Next.js globals.css 
        on the server side, preventing the white flash entirely.
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { 
          background-color: transparent !important; 
          background: transparent !important; 
        }
      `}} />
      <main className="w-full h-full bg-transparent overflow-hidden">
        <SupportWidget />
      </main>
    </>
  );
}
