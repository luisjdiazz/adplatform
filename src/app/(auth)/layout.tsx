import { Providers } from "@/components/providers";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-screen items-center justify-center bg-muted">
        {children}
      </div>
    </Providers>
  );
}
