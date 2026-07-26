import { SignIn } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-100 mb-2">LoraBiz Support</h1>
          <p className="text-slate-400 text-sm">Sign in to access the agent dashboard.</p>
        </div>
        
        {/* The magic happens here: forceRedirectUrl sends them to the dashboard after login */}
        <SignIn forceRedirectUrl="/dashboard" routing="hash" />
      </div>
    </main>
  );
}