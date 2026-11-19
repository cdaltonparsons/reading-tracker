// Static: the heading stays visible during loading and error states.
export default function ShelvesLayout({ children }: LayoutProps<"/shelves">) {
  return (
    <main className="mx-auto flex w-full min-h-screen max-w-3xl flex-col gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">My shelves</h1>
      {children}
    </main>
  );
}
