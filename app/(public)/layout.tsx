// Public-facing layout: max-width 480px, blue gradient, mobile-first
import InstallPrompt from "@/components/public/InstallPrompt";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-bg">
      <div className="mx-auto w-full max-w-[480px] min-h-dvh">
        {children}
      </div>
      <InstallPrompt />
    </div>
  );
}
