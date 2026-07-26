// app/widget/page.tsx
import SupportWidget from '@/components/SupportWidget';

export default function WidgetPage() {
  return (
    <>
      {/* Force the iframe body to be completely transparent */}
      <style dangerouslySetInnerHTML={{ __html: `
        body, html { 
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
