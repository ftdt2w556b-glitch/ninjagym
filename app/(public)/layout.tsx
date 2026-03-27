// Public-facing layout: max-width 480px, blue gradient, mobile-first
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
    </div>
  );
}
