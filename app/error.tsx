"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="empty">
      <h1>The workspace could not load.</h1>
      <p>Your saved records remain in this browser. Try loading it again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
