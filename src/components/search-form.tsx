import type { ChangeEventHandler, FormEventHandler } from "react";
import Form from "next/form";
import { SearchButton } from "./search-button";

type SearchFormProps = {
  // Pass value and onChange together to control the input. Omit both for the
  // plain uncontrolled form used as the static fallback.
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function SearchForm({ value, onChange, onSubmit }: SearchFormProps) {
  return (
    <Form
      action="/search"
      role="search"
      className="flex gap-2"
      onSubmit={onSubmit}
    >
      <label className="flex-1">
        <span className="sr-only">Search books</span>
        <input
          type="search"
          name="q"
          value={value}
          onChange={onChange}
          maxLength={200}
          placeholder="Title or author"
          className="w-full rounded-lg border border-zinc-500 px-3 py-2 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400"
        />
      </label>
      <SearchButton />
    </Form>
  );
}
