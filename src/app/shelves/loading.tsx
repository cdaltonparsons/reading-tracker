export default function ShelvesLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading shelves</span>
      <ul aria-hidden="true" className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </ul>
    </div>
  );
}
