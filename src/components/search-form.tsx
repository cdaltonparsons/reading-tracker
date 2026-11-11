import Form from "next/form";

export function SearchForm({ defaultQuery }: { defaultQuery?: string }) {
  return (
    <Form action="/search" role="search" className="flex gap-2">
      <label className="flex-1">
        <span className="sr-only">Search books</span>
        {/* key remounts the input when the query changes (Back/Forward, new
            search), since an uncontrolled input ignores defaultValue changes
            once the user has typed. Keyed here, not on <Form>, which doesn't
            support a key. */}
        <input
          key={defaultQuery ?? ""}
          type="search"
          name="q"
          defaultValue={defaultQuery}
          maxLength={200}
          placeholder="Title or author"
          className="w-full rounded-lg border border-zinc-500 px-3 py-2 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:outline-hidden"
      >
        Search
      </button>
    </Form>
  );
}
