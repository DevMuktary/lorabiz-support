// app/widget/page.tsx
import SupportWidget from '@/components/SupportWidget';

export default function WidgetPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { 
          background-color: transparent !important; 
          background: transparent !important; 
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          color-scheme: inherit !important;
        }
      `}} />
      <main className="w-full h-full bg-transparent">
        <SupportWidget />
      </main>
    </>
  );
}
