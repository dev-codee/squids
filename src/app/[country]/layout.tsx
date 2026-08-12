import PublicHeader from "@/components/store/PublicHeader";
import { getDictionary } from "@/i18n";
import { DictionaryProvider } from "@/i18n/DictionaryProvider";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { country: string };
}) {
  const dictionary = await getDictionary(params.country);

  return (
    <DictionaryProvider dictionary={dictionary}>
      <PublicHeader />
      {children}
    </DictionaryProvider>
  );
}
