export default function LoadingProducts() {
  return <div className="mx-auto max-w-shell animate-pulse px-4 py-10" aria-label="Loading products" role="status"><div className="h-10 w-2/3 rounded-lg bg-slate-200" /><div className="mt-4 h-5 w-1/2 rounded bg-slate-100" /><div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map(i=><div key={i} className="h-80 rounded-2xl bg-slate-100" />)}</div></div>;
}
