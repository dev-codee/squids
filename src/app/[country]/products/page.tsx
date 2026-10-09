import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { getProductsFromDb, getProductFacets } from "@/lib/db/products";
import { readProductCatalogParams } from "@/lib/model/productCatalog";
import { getSiteUrl } from "@/lib/regions";
import ProductCard from "@/components/product/ProductCard";
import ProductIcon from "@/components/product/ProductIcon";
import CatalogFilters from "@/components/product/CatalogFilters";
import CatalogSort from "@/components/product/CatalogSort";
import CrawlablePagination from "@/components/category/CrawlablePagination";
export const dynamic = "force-dynamic";
type Props = { params: { country: string }; searchParams: Record<string, string | string[] | undefined> };
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const d=await getDictionary(params.country);
  return { title: `${d.productShop.products} · Foxzil`, description:d.productShop.catalogSubtitle,alternates:{canonical:`${getSiteUrl()}/${params.country.toLowerCase()}/products`},robots:Object.keys(searchParams).length ? {index:false,follow:true} : {index:true,follow:true}};
}
export default async function ProductsPage({ params, searchParams }: Props) {
  const country=params.country.toUpperCase(), lc=country.toLowerCase(), q=readProductCatalogParams(searchParams);
  const [d, facets]=await Promise.all([getDictionary(country),getProductFacets(undefined,country).catch(()=>({brands:[],sizes:[],conditions:[],categories:[],currencies:[]}))]);
  const t=d.productShop;
  // Numeric prices are only comparable within one currency.
  if (!q.currency && facets.currencies?.length===1) q.currency=facets.currencies[0].name;
  if (!q.currency) {q.sort="relevance";q.minPrice=undefined;q.maxPrice=undefined;}
  let unavailable=false;
  const result=await getProductsFromDb({...q,country,pageSize:12}).catch(()=>{unavailable=true;return {products:[],page:1,pageSize:12,total:0,totalPages:1};});
  const url=(changes:Record<string,string|undefined>)=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(searchParams))if(typeof v==="string"&&v)p.set(k,v);for(const [k,v] of Object.entries(changes))v===undefined?p.delete(k):p.set(k,v);return `/${lc}/products${p.size?`?${p}`:""}`;};
  const active=Object.entries({search:q.search,category:q.category,brand:q.brand,size:q.size,condition:q.condition,stock:q.inStockOnly?d.categoryV2.inStockOnly:"",min:q.minPrice!==undefined?`${t.minPrice}: ${q.minPrice} ${q.currency}`:"",max:q.maxPrice!==undefined?`${t.maxPrice}: ${q.maxPrice} ${q.currency}`:""}).filter(([,v])=>Boolean(v));
  return <main className="min-h-screen bg-[#f7f8fa] pb-16">
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-shell px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <nav className="mb-6 flex items-center gap-2 text-xs text-ink-muted" aria-label="Breadcrumb"><Link href={`/${lc}`} className="hover:text-brand">{d.header.home}</Link><ProductIcon name="chevron" className="h-3 w-3" /><span className="text-ink">{t.products}</span></nav>
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-xl"><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand">FOXZiL · {t.products}</p><h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{q.search ? `${t.resultsFor} “${q.search}”` : t.catalogTitle}</h1><p className="mt-3 text-sm leading-relaxed text-ink-soft">{t.catalogSubtitle}</p></div>
      <form method="get" action={`/${lc}/products`} className="flex w-full items-center rounded-xl border border-slate-300 bg-[#f7f8fa] p-1.5 focus-within:border-brand lg:max-w-sm"><ProductIcon name="search" className="ml-2 h-5 w-5 shrink-0 text-ink-muted" /><input name="search" aria-label={t.search} defaultValue={q.search} placeholder={t.searchPlaceholder} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ink outline-none" maxLength={160} /><button type="submit" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand">{t.search}</button></form></div>
      {(facets.categories?.length??0)>0 && <div className="mt-6 flex gap-2 overflow-x-auto pb-1"><Link href={url({category:undefined,page:undefined})} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium ${!q.category?"border-ink bg-ink text-white":"border-slate-200 text-ink-soft hover:border-ink"}`}>{t.allProducts}</Link>{facets.categories?.map(c=><Link key={c.name} href={url({category:c.name,page:undefined})} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium ${q.category===c.name?"border-ink bg-ink text-white":"border-slate-200 text-ink-soft hover:border-ink"}`}>{c.name}<span className="ml-2 opacity-60">{c.count}</span></Link>)}</div>}
    </div></section>
    <div className="mx-auto grid max-w-shell gap-6 px-4 pt-7 sm:px-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:px-8">
      <CatalogFilters key={JSON.stringify(q)} country={lc} facets={facets} query={q} />
      <section className="min-w-0" aria-label={t.products}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-ink" aria-live="polite">{result.total===1?d.categoryV2.oneResult:d.categoryV2.resultsCount.replace("{count}",String(result.total))}</p><div className="flex flex-wrap items-center gap-3"><CatalogSort value={q.sort} currency={q.currency} /><div className="flex rounded-lg border border-slate-200 bg-white p-0.5" aria-label={t.viewOptions}>{(["grid","list"] as const).map(view=><Link key={view} href={url({view})} aria-label={view==="grid"?t.gridView:t.listView} aria-current={q.view===view?"true":undefined} className={`rounded-md p-2 ${q.view===view?"bg-slate-100 text-ink":"text-ink-muted hover:text-ink"}`}><ProductIcon name={view} className="h-4 w-4" /></Link>)}</div></div></div>
        {active.length>0 && <div className="mb-5 flex flex-wrap gap-2">{active.map(([key,value])=><Link key={key} href={url({[key]:undefined,page:undefined})} className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-soft px-3 py-1.5 text-xs font-medium text-ink">{value}<ProductIcon name="close" className="h-3 w-3" /></Link>)}<Link href={`/${lc}/products`} className="self-center px-2 text-xs text-ink-muted hover:text-brand">{t.reset}</Link></div>}
        {result.products.length>0 ? <div className={q.view==="grid"?"grid gap-4 sm:grid-cols-2 xl:grid-cols-3":"space-y-4"}>{result.products.map(p=><ProductCard product={p} layout={q.view} key={p.id} />)}</div> : <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-14 text-center"><div className="mb-5 rounded-full bg-slate-50 p-5 text-ink-muted"><ProductIcon name="search" className="h-8 w-8" /></div><h2 className="text-xl font-semibold text-ink">{unavailable?t.catalogUnavailable:t.noResults}</h2>{!unavailable&&<p className="mt-2 max-w-sm text-sm text-ink-soft">{t.noResultsBody}</p>}<Link href={`/${lc}/products`} className="mt-6 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand">{t.reset}</Link></div>}
        <CrawlablePagination page={result.page} totalPages={result.totalPages} buildHref={page=>url({page:String(page)})} previousLabel={d.categoryV2.previous} nextLabel={d.categoryV2.next} />
        <p className="mt-6 text-center text-xs leading-relaxed text-ink-muted">{d.productV2.disclosure}</p>
      </section>
    </div>
  </main>;
}
