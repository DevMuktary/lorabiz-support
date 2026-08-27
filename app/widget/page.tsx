// app/widget/page.tsx
import SupportWidget from '@/components/SupportWidget';

export default function WidgetPage() {
  return (
    <>
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
