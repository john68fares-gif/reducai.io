// components/layout/ContentWrapper.tsx
type Props = { children: React.ReactNode };

export default function ContentWrapper({ children }: Props) {
  // No margin-left or padding-left here. Let _app.tsx's flex layout handle columns.
  return (
    <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </div>
  );
}
