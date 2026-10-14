export default function ServiceLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="animate-pulse">
        <div className="h-4 w-24 bg-border rounded" />
        <div className="mt-4 h-10 w-64 bg-border rounded" />
        <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-14">
          <div className="aspect-[3/2] bg-border rounded" />
          <div className="space-y-4">
            <div className="h-4 w-full bg-border rounded" />
            <div className="h-4 w-5/6 bg-border rounded" />
            <div className="h-4 w-4/6 bg-border rounded" />
            <div className="mt-6 h-10 w-32 bg-border rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
