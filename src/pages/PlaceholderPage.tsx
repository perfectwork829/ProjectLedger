export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-muted-foreground">This module is coming soon.</p>
    </div>
  );
}
